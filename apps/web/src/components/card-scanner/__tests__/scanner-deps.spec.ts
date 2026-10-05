import { BROWSER_SCANNER_DEPS } from '../scanner-deps';

const HAVE_METADATA = 1;

function readyVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: HAVE_METADATA });
  return video;
}

function streamWith(track: Partial<MediaStreamTrack> | null): MediaStream {
  return { getVideoTracks: () => (track ? [track] : []) } as unknown as MediaStream;
}

function cameraTrack(capabilities: Record<string, unknown>, constraints: MediaTrackConstraints): Partial<MediaStreamTrack> {
  return {
    getCapabilities: () => capabilities as MediaTrackCapabilities,
    getConstraints: () => constraints,
    applyConstraints: vi.fn(async () => undefined),
  };
}

describe('detectTorch', () => {
  it('returns null for a stream without a video track', async () => {
    expect(await BROWSER_SCANNER_DEPS.detectTorch(readyVideo(), streamWith(null))).toBeNull();
  });

  it('returns null when the track cannot report capabilities', async () => {
    expect(await BROWSER_SCANNER_DEPS.detectTorch(readyVideo(), streamWith({}))).toBeNull();
  });

  it('returns null when the camera has no torch', async () => {
    const track = cameraTrack({ width: { max: 1920 } }, {});

    expect(await BROWSER_SCANNER_DEPS.detectTorch(readyVideo(), streamWith(track))).toBeNull();
  });

  it('waits for metadata before reading capabilities', async () => {
    const video = document.createElement('video');
    const track = cameraTrack({ torch: true }, {});
    const getCapabilities = vi.spyOn(track, 'getCapabilities' as never);

    const detection = BROWSER_SCANNER_DEPS.detectTorch(video, streamWith(track));
    await Promise.resolve();
    expect(getCapabilities).not.toHaveBeenCalled();
    video.dispatchEvent(new Event('loadedmetadata'));

    expect(await detection).not.toBeNull();
  });

  it('keeps the resolution and focus constraints when switching the torch', async () => {
    const constraints: MediaTrackConstraints = {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet, { torch: false } as MediaTrackConstraintSet],
    };
    const track = cameraTrack({ torch: true }, constraints);
    const torch = await BROWSER_SCANNER_DEPS.detectTorch(readyVideo(), streamWith(track));

    await torch!.setOn(true);

    expect(track.applyConstraints).toHaveBeenCalledWith({
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: 'continuous' }, { torch: true }],
    });
  });
});
