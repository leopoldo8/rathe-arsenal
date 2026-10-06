import {
  buildCameraConstraints,
  orderBackCameras,
  preferredZoom,
  readFeatures,
  setUpCamera,
  type ICameraFeatures,
} from '../camera-control';

const HAVE_METADATA = 1;
const FULL_FEATURES: ICameraFeatures = { continuousFocus: true, torch: true, zoom: { min: 1, max: 8 } };

interface IFakeTrack extends MediaStreamTrack {
  readonly applyConstraints: ReturnType<typeof vi.fn>;
  readonly stop: ReturnType<typeof vi.fn>;
}

function fakeTrack(label: string, deviceId: string, capabilities: Record<string, unknown>): IFakeTrack {
  return {
    label,
    getCapabilities: () => capabilities,
    getSettings: () => ({ deviceId }),
    applyConstraints: vi.fn(async () => undefined),
    stop: vi.fn(),
  } as unknown as IFakeTrack;
}

function streamOf(track: MediaStreamTrack | null): MediaStream {
  const tracks = track ? [track] : [];
  return { getVideoTracks: () => tracks, getTracks: () => tracks } as unknown as MediaStream;
}

function readyVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: HAVE_METADATA });
  return video;
}

function device(label: string, deviceId: string): MediaDeviceInfo {
  return { kind: 'videoinput', label, deviceId } as MediaDeviceInfo;
}

function stubMediaDevices(devices: MediaDeviceInfo[], streams: Record<string, MediaStream>): ReturnType<typeof vi.fn> {
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    const id = ((constraints.video as MediaTrackConstraints).deviceId as { exact: string }).exact;
    const stream = streams[id];
    if (!stream) throw Object.assign(new Error('busy'), { name: 'NotReadableError' });
    return stream;
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices: async () => devices },
    configurable: true,
  });
  return getUserMedia;
}

describe('buildCameraConstraints', () => {
  it('keeps focus and zoom when the torch switches on', () => {
    const constraints = buildCameraConstraints(FULL_FEATURES, { torchOn: true, zoom: 2 });

    expect(constraints).toEqual({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: 'continuous' }, { zoom: 2 }, { torch: true }],
    });
  });

  it('leaves out what the camera does not support', () => {
    const features: ICameraFeatures = { continuousFocus: false, torch: false, zoom: null };

    expect(buildCameraConstraints(features, { torchOn: true, zoom: 2 }).advanced).toEqual([]);
  });
});

describe('readFeatures', () => {
  it('reads continuous focus, torch and a usable zoom range', () => {
    const track = fakeTrack('back', 'a', { focusMode: ['manual', 'continuous'], torch: true, zoom: { min: 1, max: 10 } });

    expect(readFeatures(track)).toEqual({ continuousFocus: true, torch: true, zoom: { min: 1, max: 10 } });
  });

  it('treats a fixed zoom as no zoom', () => {
    const track = fakeTrack('back', 'a', { zoom: { min: 1, max: 1 } });

    expect(readFeatures(track)).toEqual({ continuousFocus: false, torch: false, zoom: null });
  });
});

describe('preferredZoom', () => {
  it.each([
    [{ min: 1, max: 8 }, 2],
    [{ min: 1, max: 1.5 }, 1.5],
    [null, null],
  ])('clamps 2x into %j', (range, expected) => {
    expect(preferredZoom(range)).toBe(expected);
  });
});

describe('orderBackCameras', () => {
  it('puts the main Android lens first and skips front and current cameras', () => {
    const devices = [
      device('camera2 2, facing back', 'wide'),
      device('camera2 1, facing front', 'front'),
      device('camera2 0, facing back', 'main'),
      device('camera2 3, facing back', 'current'),
    ];

    expect(orderBackCameras(devices, 'current').map((d) => d.deviceId)).toEqual(['main', 'wide']);
  });
});

describe('setUpCamera', () => {
  const attach = vi.fn();

  beforeEach(() => {
    attach.mockReset();
  });

  it('returns no controls for a stream without a video track', async () => {
    const stream = streamOf(null);

    expect(await setUpCamera({ video: readyVideo(), stream, attach })).toEqual({ stream, control: null });
  });

  it('keeps a lens that autofocuses and applies 2x zoom with continuous focus', async () => {
    const track = fakeTrack('camera2 0, facing back', 'main', { focusMode: ['continuous'], zoom: { min: 1, max: 8 } });
    const stream = streamOf(track);
    const getUserMedia = stubMediaDevices([], {});

    const setup = await setUpCamera({ video: readyVideo(), stream, attach });

    expect(setup.stream).toBe(stream);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(setup.control?.initialState).toEqual({ torchOn: false, zoom: 2 });
    expect(track.applyConstraints).toHaveBeenCalledWith(
      expect.objectContaining({ advanced: [{ focusMode: 'continuous' }, { zoom: 2 }] }),
    );
  });

  it('switches to a back lens that autofocuses, closing the first one before opening it', async () => {
    const fixed = fakeTrack('camera2 2, facing back', 'ultra-wide', { focusMode: ['manual'] });
    const main = fakeTrack('camera2 0, facing back', 'main', { focusMode: ['continuous'] });
    const mainStream = streamOf(main);
    const getUserMedia = stubMediaDevices(
      [device('camera2 2, facing back', 'ultra-wide'), device('camera2 0, facing back', 'main')],
      { main: mainStream },
    );

    const setup = await setUpCamera({ video: readyVideo(), stream: streamOf(fixed), attach });

    expect(fixed.stop).toHaveBeenCalled();
    expect(fixed.stop.mock.invocationCallOrder[0]).toBeLessThan(getUserMedia.mock.invocationCallOrder[0]!);
    expect(setup.stream).toBe(mainStream);
    expect(attach).toHaveBeenCalledWith(expect.anything(), mainStream);
    expect(setup.control?.features.continuousFocus).toBe(true);
    expect(setup.control?.describe()).toMatchObject({ tried: ['camera2 2, facing back', 'camera2 0, facing back'] });
  });

  it('reopens the original lens when no other back lens autofocuses', async () => {
    const original = fakeTrack('camera2 0, facing back', 'main', { focusMode: ['manual'] });
    const other = fakeTrack('camera2 2, facing back', 'ultra-wide', { focusMode: ['manual'] });
    const reopened = fakeTrack('camera2 0, facing back', 'main', { focusMode: ['manual'] });
    stubMediaDevices(
      [device('camera2 0, facing back', 'main'), device('camera2 2, facing back', 'ultra-wide')],
      { 'ultra-wide': streamOf(other), main: streamOf(reopened) },
    );

    const setup = await setUpCamera({ video: readyVideo(), stream: streamOf(original), attach });

    expect(other.stop).toHaveBeenCalled();
    expect(setup.stream.getVideoTracks()[0]).toBe(reopened);
    expect(setup.control?.features.continuousFocus).toBe(false);
  });
});
