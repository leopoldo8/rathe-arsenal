export interface IGrayImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export interface IPixelBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A capture of the card guide; `guide` locates it when the capture also holds a margin around it. */
export interface ICardImage extends IGrayImage {
  readonly guide?: IPixelBox;
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

export function resizeLanczos(image: IGrayImage, scale: number): IGrayImage {
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const columns = resampleWeights(image.width, width, scale);
  const rows = resampleWeights(image.height, height, scale);

  const horizontal = new Float32Array(width * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const sourceRow = y * image.width;
    for (let x = 0; x < width; x += 1) {
      const { indices, weights } = columns[x]!;
      let sum = 0;
      for (let tap = 0; tap < indices.length; tap += 1) sum += image.pixels[sourceRow + indices[tap]!]! * weights[tap]!;
      horizontal[y * width + x] = sum;
    }
  }

  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const { indices, weights } = rows[y]!;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let tap = 0; tap < indices.length; tap += 1) sum += horizontal[indices[tap]! * width + x]! * weights[tap]!;
      pixels[y * width + x] = sum;
    }
  }
  return { width, height, pixels };
}

export function resizeToHeight(image: IGrayImage, height: number): IGrayImage {
  return resizeLanczos(image, height / image.height);
}

interface IResampleTaps {
  readonly indices: Int32Array;
  readonly weights: Float32Array;
}

// Shrinking widens the kernel by 1/scale so every source pixel contributes,
// otherwise thin glyph strokes alias away.
function resampleWeights(sourceSize: number, targetSize: number, scale: number): IResampleTaps[] {
  const stretch = Math.max(1, 1 / scale);
  const support = LANCZOS_RADIUS * stretch;
  return Array.from({ length: targetSize }, (_, target) => {
    const center = (target + 0.5) / scale - 0.5;
    const first = Math.floor(center - support) + 1;
    const last = Math.floor(center + support);
    const indices: number[] = [];
    const weights: number[] = [];
    let total = 0;
    for (let source = first; source <= last; source += 1) {
      const weight = lanczos((center - source) / stretch);
      if (weight === 0) continue;
      indices.push(clamp(source, sourceSize - 1));
      weights.push(weight);
      total += weight;
    }
    return { indices: Int32Array.from(indices), weights: Float32Array.from(weights, (weight) => weight / total) };
  });
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
