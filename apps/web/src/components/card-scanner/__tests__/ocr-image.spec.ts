import { resizeLanczos, resizeToHeight, type IGrayImage } from '../ocr-image';

const RADIUS = 3;

function lanczos(distance: number): number {
  if (distance === 0) return 1;
  if (Math.abs(distance) >= RADIUS) return 0;
  const piDistance = Math.PI * distance;
  return (RADIUS * Math.sin(piDistance) * Math.sin(piDistance / RADIUS)) / (piDistance * piDistance);
}

// The single-pass 2D upscale this module used before; the separable one must match it.
function referenceUpscale(image: IGrayImage, scale: number): IGrayImage {
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const pixels = new Uint8ClampedArray(width * height);
  const clamp = (value: number, max: number): number => Math.min(max, Math.max(0, value));
  for (let y = 0; y < height; y += 1) {
    const sourceY = (y + 0.5) / scale - 0.5;
    for (let x = 0; x < width; x += 1) {
      const sourceX = (x + 0.5) / scale - 0.5;
      let sum = 0;
      let weightSum = 0;
      for (let dy = 1 - RADIUS; dy <= RADIUS; dy += 1) {
        const weightY = lanczos(sourceY - (Math.floor(sourceY) + dy));
        const row = clamp(Math.floor(sourceY) + dy, image.height - 1) * image.width;
        for (let dx = 1 - RADIUS; dx <= RADIUS; dx += 1) {
          const weight = lanczos(sourceX - (Math.floor(sourceX) + dx)) * weightY;
          sum += image.pixels[row + clamp(Math.floor(sourceX) + dx, image.width - 1)]! * weight;
          weightSum += weight;
        }
      }
      pixels[y * width + x] = sum / weightSum;
    }
  }
  return { width, height, pixels };
}

function noise(width: number, height: number): IGrayImage {
  let seed = 7;
  const pixels = Uint8ClampedArray.from({ length: width * height }, () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % 256;
  });
  return { width, height, pixels };
}

describe('resizeLanczos', () => {
  it.each([3, 4, 1.8])('matches the single-pass upscale at %sx within one grey level', (scale) => {
    const image = noise(41, 17);

    const actual = resizeLanczos(image, scale);
    const expected = referenceUpscale(image, scale);

    expect([actual.width, actual.height]).toEqual([expected.width, expected.height]);
    const worst = actual.pixels.reduce((max, value, i) => Math.max(max, Math.abs(value - expected.pixels[i]!)), 0);
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('keeps a flat image flat when shrinking', () => {
    const image: IGrayImage = { width: 60, height: 30, pixels: new Uint8ClampedArray(60 * 30).fill(200) };

    const shrunk = resizeLanczos(image, 0.4);

    expect([shrunk.width, shrunk.height]).toEqual([24, 12]);
    expect(new Set(shrunk.pixels)).toEqual(new Set([200]));
  });
});

describe('resizeToHeight', () => {
  it.each([
    [50, 150],
    [82, 150],
    [300, 150],
  ])('brings a %spx line to %spx', (height, target) => {
    expect(resizeToHeight(noise(Math.round(height * 10.8), height), target).height).toBe(target);
  });
});
