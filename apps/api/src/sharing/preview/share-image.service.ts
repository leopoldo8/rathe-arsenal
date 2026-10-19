import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { SharedDeckLookup, type ILiveSharedDeck } from '../shared-deck-lookup';
import { computeShareImageHash } from './share-image-hash';
import { buildPreviewDeck, type IPreviewDeck } from './preview-deck';
import { CardFaceFetcher } from './card-face-fetcher';
import { renderShareImage, type IShareImageInput } from './share-image-renderer';
import { SharePreviewStore } from './share-preview.store';
import { trimTrailingSlash } from './share-copy';

export interface IServedShareImage {
  readonly jpeg: Buffer;
  readonly fileSlug: string;
  // False when a card face failed to load: the image is served but not stored, so the next request retries.
  readonly complete: boolean;
}

const LEGAL_LINE = '© Legend Story Studios · Projeto de fã não oficial';
const GENERIC_FILE_SLUG = 'rathe-arsenal';
const MAX_SLUG_LENGTH = 60;

export function toFileSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug || GENERIC_FILE_SLUG;
}

function addressWithoutScheme(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

@Injectable()
export class ShareImageService {
  private readonly logger = new Logger(ShareImageService.name);
  private readonly baseUrl: string;
  private genericImage: Promise<Buffer> | null = null;
  private readonly inFlight = new Map<string, Promise<IServedShareImage>>();

  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly store: SharePreviewStore,
    private readonly faceFetcher: CardFaceFetcher,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
    config: ConfigService,
  ) {
    this.baseUrl = trimTrailingSlash(config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173');
  }

  async imageForToken(token: string): Promise<IServedShareImage> {
    const live = await this.lookup.findLive(token);
    if (!live) return { jpeg: await this.generic(), fileSlug: GENERIC_FILE_SLUG, complete: true };
    return this.imageForDeck(token, live);
  }

  private generic(): Promise<Buffer> {
    this.genericImage ??= this.renderGeneric().catch((error: unknown) => {
      this.genericImage = null;
      throw error;
    });
    return this.genericImage;
  }

  private renderGeneric(): Promise<Buffer> {
    return renderShareImage(
      {
        kindLabel: 'Deck',
        sharerName: '',
        title: 'Rathe Arsenal',
        heroName: 'Seu deck de Flesh and Blood',
        detail: 'Veja se ele está pronto',
        shareAddress: addressWithoutScheme(this.baseUrl),
        legalLine: LEGAL_LINE,
        byLabel: '',
      },
      { faces: [], backdrop: null },
    );
  }

  private imageForDeck(token: string, live: ILiveSharedDeck): Promise<IServedShareImage> {
    const key = `${live.deck.id}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const started = this.produce(token, live).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, started);
    return started;
  }

  private async produce(token: string, live: ILiveSharedDeck): Promise<IServedShareImage> {
    const rows = await this.deckCards.find({ where: { trackedDeckId: live.deck.id } });
    const deck = buildPreviewDeck(live.deck, live.owner, rows);
    const shareUrl = `${this.baseUrl}/d/${token}`;
    const drawn = deck.faces.map((face) => face.cardIdentifier);
    const blocked = await this.store.blockedAmong(drawn);
    const contentHash = computeShareImageHash({
      name: deck.name,
      hero: deck.hero,
      format: deck.format,
      sharerName: deck.sharerName,
      totalCards: deck.totalCards,
      drawnCardIdentifiers: drawn,
      blockedCardIdentifiers: blocked,
      shareUrl,
    });
    const fileSlug = toFileSlug(deck.name);

    const stored = await this.store.find('deck', deck.deckId);
    if (stored?.contentHash === contentHash) return { jpeg: stored.jpeg, fileSlug, complete: true };

    const visible = deck.faces.filter((face) => !blocked.includes(face.cardIdentifier));
    const fetched = await this.faceFetcher.fetchFaces(visible);
    const bufferById = new Map(visible.map((face, index) => [face.cardIdentifier, fetched[index] ?? null]));
    const faces = deck.faces.map((face) => bufferById.get(face.cardIdentifier) ?? null);
    const jpeg = await renderShareImage(this.describe(deck, shareUrl), {
      faces,
      backdrop: faces[0] ?? null,
    });

    const complete = visible.every((face) => bufferById.get(face.cardIdentifier));
    if (complete) {
      const shown = visible.map((face) => face.cardIdentifier);
      await this.store.save({ targetKind: 'deck', targetId: deck.deckId, contentHash, cardIdentifiers: shown, jpeg });
    } else {
      this.logger.warn(`Share image for deck ${deck.deckId} rendered with missing faces and not stored`);
    }
    return { jpeg, fileSlug, complete };
  }

  private describe(deck: IPreviewDeck, shareUrl: string): IShareImageInput {
    return {
      kindLabel: 'Deck',
      sharerName: deck.sharerName,
      title: deck.name,
      heroName: deck.hero,
      detail: `${deck.format} · ${deck.totalCards} cartas`,
      shareAddress: addressWithoutScheme(shareUrl),
      legalLine: LEGAL_LINE,
      byLabel: 'por',
    };
  }
}
