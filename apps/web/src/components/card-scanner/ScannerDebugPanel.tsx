import React, { useEffect, useRef } from 'react';
import type { IGrayImage } from './ocr-image';
import styles from './CardScanner.module.css';

export interface IDebugRead {
  readonly text: string;
  readonly ms: number;
}

interface IScannerDebugPanelProps {
  readonly camera: Readonly<Record<string, unknown>> | null;
  readonly crop: IGrayImage | null;
  readonly reads: Readonly<Record<string, IDebugRead>>;
}

/** Developer readout behind `?debug=1`; its text is intentionally not translated. */
export function ScannerDebugPanel({ camera, crop, reads }: IScannerDebugPanelProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crop) return;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const rgba = new Uint8ClampedArray(crop.width * crop.height * 4);
    crop.pixels.forEach((value, index) => {
      rgba.set([value, value, value, 255], index * 4);
    });
    context.putImageData(new ImageData(rgba, crop.width, crop.height), 0, 0);
  }, [crop]);

  return (
    <section className={styles.debugPanel} data-testid="scanner-debug">
      <canvas ref={canvasRef} className={styles.debugCrop} />
      <pre className={styles.debugText}>
        {Object.entries(reads)
          .map(([variant, read]) => `${variant} (${read.ms} ms): ${read.text.trim() || '(empty)'}`)
          .join('\n')}
      </pre>
      <pre className={styles.debugText}>{camera ? JSON.stringify(camera, null, 1) : 'camera: (no controls)'}</pre>
    </section>
  );
}
