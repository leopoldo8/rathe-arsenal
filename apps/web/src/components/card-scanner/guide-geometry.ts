export interface IPixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Card guide inside the stage, as fractions of the stage box. */
export const CARD_GUIDE = { left: 0.09, top: 0.07, width: 0.82, height: 0.86 } as const;

/**
 * Maps the guide (fractions of the on-screen stage) onto the video's own
 * pixels, for a video drawn with `object-fit: cover`.
 */
export function guideRectInVideo(
  video: { readonly width: number; readonly height: number },
  stage: { readonly width: number; readonly height: number },
): IPixelRect {
  const scale = Math.max(stage.width / video.width, stage.height / video.height);
  const visibleWidth = stage.width / scale;
  const visibleHeight = stage.height / scale;
  const offsetX = (video.width - visibleWidth) / 2;
  const offsetY = (video.height - visibleHeight) / 2;
  return {
    x: Math.round(offsetX + CARD_GUIDE.left * visibleWidth),
    y: Math.round(offsetY + CARD_GUIDE.top * visibleHeight),
    width: Math.round(CARD_GUIDE.width * visibleWidth),
    height: Math.round(CARD_GUIDE.height * visibleHeight),
  };
}
