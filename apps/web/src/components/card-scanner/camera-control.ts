export interface IZoomRange {
  readonly min: number;
  readonly max: number;
}

export interface ICameraFeatures {
  readonly continuousFocus: boolean;
  readonly torch: boolean;
  readonly zoom: IZoomRange | null;
}

export interface ICameraState {
  readonly torchOn: boolean;
  readonly zoom: number | null;
}

export interface ICameraControl {
  readonly features: ICameraFeatures;
  readonly initialState: ICameraState;
  readonly apply: (state: ICameraState) => Promise<void>;
  readonly describe: () => Record<string, unknown>;
}

export interface ICameraSetup {
  readonly stream: MediaStream;
  readonly control: ICameraControl | null;
}

export const STREAM_RESOLUTION = { width: { ideal: 1920 }, height: { ideal: 1080 } } as const;

const PREFERRED_ZOOM = 2;
const METADATA_TIMEOUT_MS = 3000;
const HAVE_METADATA = 1;
const BACK_CAMERA_LABEL = /back|rear|environment|traseira/i;
const ANDROID_CAMERA_INDEX = /camera2? (\d+)/i;

// `torch`, `zoom` and `focusMode` are image-capture extensions that lib.dom does not type.
type TCameraConstraintSet = MediaTrackConstraintSet & { torch?: boolean; zoom?: number | boolean; focusMode?: string };
interface ICameraCapabilities extends MediaTrackCapabilities {
  readonly torch?: boolean;
  readonly zoom?: { readonly min: number; readonly max: number };
  readonly focusMode?: readonly string[];
  readonly focusDistance?: unknown;
}

/** Zoom is requested up front: Chrome only exposes it after the pan-tilt-zoom permission. */
export function videoConstraints(device: Pick<MediaTrackConstraints, 'deviceId' | 'facingMode'>): MediaTrackConstraints {
  return { ...device, ...STREAM_RESOLUTION, zoom: true } as MediaTrackConstraints;
}

// applyConstraints replaces the whole set, so every call carries focus, zoom
// and torch together; sending one alone lets the browser reset the others.
export function buildCameraConstraints(features: ICameraFeatures, state: ICameraState): MediaTrackConstraints {
  const advanced: TCameraConstraintSet[] = [];
  if (features.continuousFocus) advanced.push({ focusMode: 'continuous' });
  if (features.zoom && state.zoom !== null) advanced.push({ zoom: state.zoom });
  if (features.torch) advanced.push({ torch: state.torchOn });
  return { ...STREAM_RESOLUTION, advanced };
}

export function readFeatures(track: MediaStreamTrack): ICameraFeatures {
  const capabilities = track.getCapabilities() as ICameraCapabilities;
  const zoom = capabilities.zoom;
  return {
    continuousFocus: capabilities.focusMode?.includes('continuous') ?? false,
    torch: capabilities.torch === true,
    zoom: zoom && zoom.max > zoom.min ? { min: zoom.min, max: zoom.max } : null,
  };
}

export function preferredZoom(range: IZoomRange | null): number | null {
  if (!range) return null;
  return Math.min(range.max, Math.max(range.min, PREFERRED_ZOOM));
}

/** Main lens first: Android labels its cameras "camera2 <index>", and index 0 is the main one. */
export function orderBackCameras(devices: readonly MediaDeviceInfo[], currentDeviceId: string | undefined): MediaDeviceInfo[] {
  return devices
    .filter((device) => device.kind === 'videoinput' && device.deviceId !== currentDeviceId)
    .filter((device) => BACK_CAMERA_LABEL.test(device.label))
    .sort((a, b) => cameraIndex(a) - cameraIndex(b));
}

function cameraIndex(device: MediaDeviceInfo): number {
  const match = ANDROID_CAMERA_INDEX.exec(device.label);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

interface ISetUpOptions {
  readonly video: HTMLVideoElement;
  readonly stream: MediaStream;
  readonly attach: (video: HTMLVideoElement, stream: MediaStream) => void;
}

/** When the opened lens cannot autofocus, tries the other back cameras before settling. */
export async function setUpCamera({ video, stream, attach }: ISetUpOptions): Promise<ICameraSetup> {
  const track = stream.getVideoTracks?.()[0];
  if (!track || typeof track.getCapabilities !== 'function') return { stream, control: null };
  await waitForMetadata(video);

  const tried = [track.label];
  let chosen = { stream, track, features: readFeatures(track) };
  if (!chosen.features.continuousFocus) {
    const better = await findFocusingCamera({ video, stream, attach }, track, tried);
    if (better) chosen = better;
  }

  const backCameras = await listBackCameraLabels();
  const initialState: ICameraState = { torchOn: false, zoom: preferredZoom(chosen.features.zoom) };
  const apply = (state: ICameraState): Promise<void> =>
    chosen.track.applyConstraints(buildCameraConstraints(chosen.features, state));
  await apply(initialState).catch(() => undefined);

  return {
    stream: chosen.stream,
    control: {
      features: chosen.features,
      initialState,
      apply,
      describe: () => describeTrack(chosen.track, { backCameras, tried }),
    },
  };
}

interface IChosenCamera {
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  readonly features: ICameraFeatures;
}

async function findFocusingCamera(
  { video, stream, attach }: ISetUpOptions,
  original: MediaStreamTrack,
  tried: string[],
): Promise<IChosenCamera | null> {
  const devices = (await navigator.mediaDevices.enumerateDevices?.().catch(() => [])) ?? [];
  const originalDeviceId = original.getSettings().deviceId;
  const candidates = orderBackCameras(devices, originalDeviceId);
  if (candidates.length === 0) return null;

  // Many Android devices refuse to open a second camera while one is live.
  stream.getTracks().forEach((t) => t.stop());
  for (const candidate of candidates) {
    tried.push(candidate.label);
    const opened = await openDevice(candidate.deviceId);
    if (!opened) continue;
    const track = opened.getVideoTracks()[0]!;
    attach(video, opened);
    await waitForMetadata(video);
    const features = readFeatures(track);
    if (features.continuousFocus) return { stream: opened, track, features };
    opened.getTracks().forEach((t) => t.stop());
  }

  const reopened = (originalDeviceId ? await openDevice(originalDeviceId) : null) ?? (await openDevice(null));
  if (!reopened) return null;
  const track = reopened.getVideoTracks()[0]!;
  attach(video, reopened);
  await waitForMetadata(video);
  return { stream: reopened, track, features: readFeatures(track) };
}

async function openDevice(deviceId: string | null): Promise<MediaStream | null> {
  const device = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' };
  try {
    return await navigator.mediaDevices.getUserMedia({ video: videoConstraints(device), audio: false });
  } catch {
    return null;
  }
}

async function listBackCameraLabels(): Promise<string[]> {
  const devices = (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])) ?? [];
  return devices.filter((device) => device.kind === 'videoinput').map((device) => device.label);
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, METADATA_TIMEOUT_MS);
    video.addEventListener(
      'loadedmetadata',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

const DESCRIBED_SETTINGS = ['width', 'height', 'focusMode', 'focusDistance', 'zoom', 'torch'] as const;
const DESCRIBED_CAPABILITIES = ['focusMode', 'focusDistance', 'zoom', 'torch', 'width', 'height'] as const;

function describeTrack(
  track: MediaStreamTrack,
  extra: { readonly backCameras: readonly string[]; readonly tried: readonly string[] },
): Record<string, unknown> {
  const settings = track.getSettings() as Record<string, unknown>;
  const capabilities = track.getCapabilities() as Record<string, unknown>;
  return {
    label: track.label,
    settings: Object.fromEntries(DESCRIBED_SETTINGS.map((key) => [key, settings[key]])),
    capabilities: Object.fromEntries(DESCRIBED_CAPABILITIES.map((key) => [key, capabilities[key]])),
    cameras: extra.backCameras,
    tried: extra.tried,
  };
}
