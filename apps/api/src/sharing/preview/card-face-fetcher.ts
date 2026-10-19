import { Injectable, Logger } from '@nestjs/common';
import { IMAGE_CDN_BASE } from '@rathe-arsenal/engine';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import type { IPreviewFace } from './preview-deck';

const FACE_TIMEOUT_MS = 4000;
const FACE_MAX_BYTES = 3 * 1024 * 1024;
const FACE_CONCURRENCY = 5;

@Injectable()
export class CardFaceFetcher {
  private readonly logger = new Logger(CardFaceFetcher.name);
  private readonly allowHosts = [new URL(IMAGE_CDN_BASE).hostname];

  constructor(private readonly fetchGuard: FetchGuardService) {}

  /** One entry per face, in order; null where every source failed or answered with an error. */
  async fetchFaces(faces: readonly IPreviewFace[]): Promise<(Buffer | null)[]> {
    const results: (Buffer | null)[] = new Array(faces.length).fill(null);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < faces.length) {
        const index = next++;
        results[index] = await this.fetchFace(faces[index]!);
      }
    };
    await Promise.all(Array.from({ length: Math.min(FACE_CONCURRENCY, faces.length) }, worker));
    return results;
  }

  private async fetchFace(face: IPreviewFace): Promise<Buffer | null> {
    for (const url of face.largeSources) {
      try {
        const response = await this.fetchGuard.guardedFetch(url, {
          allowHosts: this.allowHosts,
          maxBytes: FACE_MAX_BYTES,
          timeoutMs: FACE_TIMEOUT_MS,
        });
        if (response.status === 200 && response.body.byteLength > 0) return Buffer.from(response.body);
      } catch (error) {
        this.logger.warn(`Card face fetch failed for ${face.cardIdentifier}: ${(error as Error).message}`);
      }
    }
    return null;
  }
}
