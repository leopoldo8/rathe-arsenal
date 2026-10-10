import { createContext, useContext } from 'react';
import { setUpCamera, videoConstraints, type ICameraSetup } from './camera-control';
import { guideRectInVideo } from './guide-geometry';
import { createOcrEngine, type IOcrEngine } from './ocr-engine';
import { rgbaToGray, type ICardImage } from './ocr-image';

export type TCameraFailure = 'denied' | 'no-camera' | 'error';

export class CameraError extends Error {
  constructor(public readonly failure: TCameraFailure) {
    super(failure);
    this.name = 'CameraError';
  }
}

export interface IScannerDeps {
  readonly openCamera: () => Promise<MediaStream>;
  readonly attachStream: (video: HTMLVideoElement, stream: MediaStream) => void;
  readonly setUpCamera: (video: HTMLVideoElement, stream: MediaStream) => Promise<ICameraSetup>;
  readonly captureCard: (video: HTMLVideoElement, stage: HTMLElement) => ICardImage | null;
  readonly loadEngine: () => Promise<IOcrEngine>;
  readonly scheduleTicks: (tick: () => void) => () => void;
}

const SCAN_TICK_MS = 120;
// Room around the guide for the corners of a tilted card (about 10° of tilt).
const CAPTURE_MARGIN = 0.08;
const OCR_ASSET_PATH = '/ocr/';

async function openRearCamera(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('no-camera');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints({ facingMode: 'environment' }),
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

function setUpBrowserCamera(video: HTMLVideoElement, stream: MediaStream): Promise<ICameraSetup> {
  return setUpCamera({ video, stream, attach: attachStream });
}

function captureCard(video: HTMLVideoElement, stage: HTMLElement): ICardImage | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const guide = guideRectInVideo(
    { width: video.videoWidth, height: video.videoHeight },
    { width: stage.clientWidth, height: stage.clientHeight },
  );
  const margin = Math.round(guide.width * CAPTURE_MARGIN);
  const left = Math.max(0, guide.x - margin);
  const top = Math.max(0, guide.y - margin);
  const width = Math.min(video.videoWidth, guide.x + guide.width + margin) - left;
  const height = Math.min(video.videoHeight, guide.y + guide.height + margin) - top;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, left, top, width, height, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return {
    ...rgbaToGray(data, width, height),
    guide: { x: guide.x - left, y: guide.y - top, width: guide.width, height: guide.height },
  };
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
  setUpCamera: setUpBrowserCamera,
  captureCard,
  loadEngine,
  scheduleTicks,
};

export const ScannerDepsContext = createContext<IScannerDeps>(BROWSER_SCANNER_DEPS);

export function useScannerDeps(): IScannerDeps {
  return useContext(ScannerDepsContext);
}
