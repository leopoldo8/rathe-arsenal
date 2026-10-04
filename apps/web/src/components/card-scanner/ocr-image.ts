export interface IGrayImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export interface IFractionRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const LANCZOS_RADIUS = 3;
const PERCENTILE_CLIP = 0.01;
const BMP_PIXELS_PER_METER_72_DPI = 2835;

export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): IGrayImage {
  const pixels = new Uint8ClampedArray(width * height);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (rgba[i * 4]! * 299 + rgba[i * 4 + 1]! * 587 + rgba[i * 4 + 2]! * 114) / 1000;
  }
  return { width, height, pixels };
}

export function cropFraction(image: IGrayImage, rect: IFractionRect): IGrayImage {
  const left = Math.round(rect.left * image.width);
  const top = Math.round(rect.top * image.height);
  const width = Math.max(1, Math.min(image.width - left, Math.round(rect.width * image.width)));
  const height = Math.max(1, Math.min(image.height - top, Math.round(rect.height * image.height)));
  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    pixels.set(image.pixels.subarray((top + y) * image.width + left, (top + y) * image.width + left + width), y * width);
  }
  return { width, height, pixels };
}

export function stretchContrast(image: IGrayImage): IGrayImage {
  const histogram = new Array<number>(256).fill(0);
  for (const value of image.pixels) histogram[value]! += 1;
  const clipCount = image.pixels.length * PERCENTILE_CLIP;
  const low = percentileBound(histogram, clipCount, 1);
  const high = percentileBound(histogram, clipCount, -1);
  const range = high - low || 1;
  return { ...image, pixels: image.pixels.map((value) => ((value - low) * 255) / range) };
}

function percentileBound(histogram: readonly number[], clipCount: number, direction: 1 | -1): number {
  let accumulated = 0;
  for (let step = 0; step < 256; step += 1) {
    const value = direction === 1 ? step : 255 - step;
    accumulated += histogram[value]!;
    if (accumulated >= clipCount) return value;
  }
  return direction === 1 ? 0 : 255;
}

export function upscaleLanczos(image: IGrayImage, scale: number): IGrayImage {
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = (y + 0.5) / scale - 0.5;
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = sampleLanczos(image, (x + 0.5) / scale - 0.5, sourceY);
    }
  }
  return { width, height, pixels };
}

function sampleLanczos(image: IGrayImage, sourceX: number, sourceY: number): number {
  const baseX = Math.floor(sourceX);
  const baseY = Math.floor(sourceY);
  let sum = 0;
  let weightSum = 0;
  for (let dy = 1 - LANCZOS_RADIUS; dy <= LANCZOS_RADIUS; dy += 1) {
    const weightY = lanczos(sourceY - (baseY + dy));
    const row = clamp(baseY + dy, image.height - 1) * image.width;
    for (let dx = 1 - LANCZOS_RADIUS; dx <= LANCZOS_RADIUS; dx += 1) {
      const weight = lanczos(sourceX - (baseX + dx)) * weightY;
      sum += image.pixels[row + clamp(baseX + dx, image.width - 1)]! * weight;
      weightSum += weight;
    }
  }
  return sum / weightSum;
}

function lanczos(distance: number): number {
  if (distance === 0) return 1;
  if (Math.abs(distance) >= LANCZOS_RADIUS) return 0;
  const piDistance = Math.PI * distance;
  return (LANCZOS_RADIUS * Math.sin(piDistance) * Math.sin(piDistance / LANCZOS_RADIUS)) / (piDistance * piDistance);
}

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

export function invert(image: IGrayImage): IGrayImage {
  return { ...image, pixels: image.pixels.map((value) => 255 - value) };
}

export function threshold(image: IGrayImage, cutoff: number): IGrayImage {
  return { ...image, pixels: image.pixels.map((value) => (value >= cutoff ? 255 : 0)) };
}

export function encodeBmp(image: IGrayImage): Uint8Array<ArrayBuffer> {
  const rowSize = Math.ceil((image.width * 3) / 4) * 4;
  const dataSize = rowSize * image.height;
  const bytes = new Uint8Array(54 + dataSize);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, image.width, true);
  view.setInt32(22, image.height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, dataSize, true);
  view.setInt32(38, BMP_PIXELS_PER_METER_72_DPI, true);
  view.setInt32(42, BMP_PIXELS_PER_METER_72_DPI, true);
  for (let y = 0; y < image.height; y += 1) {
    const rowStart = 54 + (image.height - 1 - y) * rowSize;
    for (let x = 0; x < image.width; x += 1) {
      const value = image.pixels[y * image.width + x]!;
      bytes.fill(value, rowStart + x * 3, rowStart + x * 3 + 3);
    }
  }
  return bytes;
}
