import { encodeBmp, type IGrayImage } from './ocr-image';
import type { IOcrVariant } from './ocr-variants';

export interface IOcrEngine {
  readonly recognize: (card: IGrayImage, variant: IOcrVariant) => Promise<string>;
  readonly terminate: () => Promise<void>;
}

export interface IOcrEngineOptions {
  readonly workerOptions: Readonly<Record<string, unknown>>;
  readonly toInput: (bmp: Uint8Array) => Blob | Uint8Array;
}

const LSTM_ONLY_ENGINE_MODE = 1;

export async function createOcrEngine(options: IOcrEngineOptions): Promise<IOcrEngine> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', LSTM_ONLY_ENGINE_MODE, options.workerOptions);
  return {
    recognize: async (card, variant) => {
      await worker.setParameters(variant.parameters);
      const input = options.toInput(encodeBmp(variant.prepare(card)));
      const { data } = await worker.recognize(input as Blob);
      return data.text;
    },
    terminate: async () => {
      await worker.terminate();
    },
  };
}
