import { OCR_VARIANTS, type IOcrVariant } from '../ocr-variants';
import { createScanLoop } from '../scan-loop';

function loopWith(recognize: () => Promise<string>, onText = vi.fn()) {
  const recognizeSpy = vi.fn((_frame: string, _variant: IOcrVariant) => recognize());
  const loop = createScanLoop({
    variants: OCR_VARIANTS,
    captureFrame: () => 'frame',
    recognize: recognizeSpy,
    onText,
    onError: vi.fn(),
  });
  return { loop, recognizeSpy, onText };
}

describe('scan loop', () => {
  it('starts one recognition at a time', () => {
    const { loop, recognizeSpy } = loopWith(() => new Promise<string>(() => undefined));

    for (let tick = 0; tick < 5; tick += 1) loop.tick();

    expect(recognizeSpy).toHaveBeenCalledTimes(1);
  });

  it('rotates variants across recognitions', async () => {
    const { loop, recognizeSpy } = loopWith(() => Promise.resolve('text'));

    for (let tick = 0; tick < 4; tick += 1) {
      loop.tick();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    expect(recognizeSpy.mock.calls.map(([, variant]) => variant.id)).toEqual([
      'full',
      'left-binary',
      'full-binary-sparse',
      'full',
    ]);
  });

  it('does not recognize while paused', () => {
    const { loop, recognizeSpy } = loopWith(() => Promise.resolve('text'));

    loop.setPaused(true);
    loop.tick();

    expect(recognizeSpy).not.toHaveBeenCalled();
  });
});
