import { createContext, useContext } from 'react';
import { guideRectInVideo } from './guide-geometry';
import { createOcrEngine, type IOcrEngine } from './ocr-engine';
import { rgbaToGray, type IGrayImage } from './ocr-image';

export type TCameraFailure = 'denied' | 'no-camera' | 'error';

export class CameraError extends Error {
  constructor(public readonly failure: TCameraFailure) {
    super(failure);
    this.name = 'CameraError';
  }
}

export interface ITorchControl {
  readonly setOn: (on: boolean) => Promise<void>;
}

export interface IScannerDeps {
  readonly openCamera: () => Promise<MediaStream>;
  readonly attachStream: (video: HTMLVideoElement, stream: MediaStream) => void;
  readonly detectTorch: (video: HTMLVideoElement, stream: MediaStream) => Promise<ITorchControl | null>;
  readonly captureCard: (video: HTMLVideoElement, stage: HTMLElement) => IGrayImage | null;
  readonly loadEngine: () => Promise<IOcrEngine>;
  readonly scheduleTicks: (tick: () => void) => () => void;
}

const SCAN_TICK_MS = 120;
const HAVE_METADATA = 1;
const OCR_ASSET_PATH = '/ocr/';

// `torch` and `focusMode` are image-capture extensions that lib.dom does not type.
type TCameraConstraintSet = MediaTrackConstraintSet & { torch?: boolean; focusMode?: string };
type TCameraCapabilities = MediaTrackCapabilities & { torch?: boolean };

async function openRearCamera(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('no-camera');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: 'continuous' } as TCameraConstraintSet],
      },
      audio: false,
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('no-camera');
    throw new CameraError('error');
  }
}

function attachStream(video: HTMLVideoElement, stream: MediaStream): void {
  video.srcObject = stream;
  void video.play().catch(() => undefined);
}

async function detectTorch(video: HTMLVideoElement, stream: MediaStream): Promise<ITorchControl | null> {
  const track = stream.getVideoTracks?.()[0];
  if (!track || typeof track.getCapabilities !== 'function') return null;
  // Some Android builds report empty capabilities until the first frames arrive.
  if (video.readyState < HAVE_METADATA) {
    await new Promise<void>((resolve) => video.addEventListener('loadedmetadata', () => resolve(), { once: true }));
  }
  const capabilities = track.getCapabilities() as TCameraCapabilities;
  if (!capabilities.torch) return null;
  return { setOn: (on) => applyTorch(track, on) };
}

// applyConstraints replaces the whole set: sending the torch alone lets the
// browser drop the resolution ideals the recognizer depends on.
function applyTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  const current = track.getConstraints();
  const advanced = (current.advanced ?? []).filter((set) => !('torch' in set));
  return track.applyConstraints({ ...current, advanced: [...advanced, { torch: on } as TCameraConstraintSet] });
}

function captureCard(video: HTMLVideoElement, stage: HTMLElement): IGrayImage | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const rect = guideRectInVideo(
    { width: video.videoWidth, height: video.videoHeight },
    { width: stage.clientWidth, height: stage.clientHeight },
  );
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const { data } = context.getImageData(0, 0, rect.width, rect.height);
  return rgbaToGray(data, rect.width, rect.height);
}

function loadEngine(): Promise<IOcrEngine> {
  return createOcrEngine({
    workerOptions: {
      workerPath: `${OCR_ASSET_PATH}worker.min.js`,
      corePath: OCR_ASSET_PATH,
      langPath: OCR_ASSET_PATH,
      gzip: true,
    },
    toInput: (bmp) => new Blob([bmp], { type: 'image/bmp' }),
  });
}

function scheduleTicks(tick: () => void): () => void {
  const handle = window.setInterval(tick, SCAN_TICK_MS);
  return () => window.clearInterval(handle);
}

export const BROWSER_SCANNER_DEPS: IScannerDeps = {
  openCamera: openRearCamera,
  attachStream,
  detectTorch,
  captureCard,
  loadEngine,
  scheduleTicks,
};

export const ScannerDepsContext = createContext<IScannerDeps>(BROWSER_SCANNER_DEPS);

export function useScannerDeps(): IScannerDeps {
  return useContext(ScannerDepsContext);
}
