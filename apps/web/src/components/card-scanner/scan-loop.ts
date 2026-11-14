import type { IOcrVariant } from './ocr-variants';

export interface IScanLoopDeps<TFrame> {
  readonly variants: readonly IOcrVariant[];
  /** `attempt` counts reads, so a capture can alternate between crops of the card. */
  readonly captureFrame: (attempt: number) => TFrame | null;
  readonly recognize: (frame: TFrame, variant: IOcrVariant) => Promise<string>;
  readonly onText: (variant: IOcrVariant, text: string) => void;
  readonly onError: (error: unknown) => void;
}

export interface IScanLoop {
  readonly tick: () => void;
  readonly setPaused: (paused: boolean) => void;
}

export function createScanLoop<TFrame>(deps: IScanLoopDeps<TFrame>): IScanLoop {
  let inFlight = false;
  let paused = false;
  let nextVariant = 0;

  return {
    tick: () => {
      if (inFlight || paused) return;
      const frame = deps.captureFrame(nextVariant);
      if (frame === null) return;
      const variant = deps.variants[nextVariant % deps.variants.length]!;
      nextVariant += 1;
      inFlight = true;
      deps
        .recognize(frame, variant)
        .then((text) => {
          if (!paused) deps.onText(variant, text);
        })
        .catch(deps.onError)
        .finally(() => {
          inFlight = false;
        });
    },
    setPaused: (value) => {
      paused = value;
    },
  };
}
