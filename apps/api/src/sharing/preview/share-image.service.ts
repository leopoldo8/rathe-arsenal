import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { SharedDeckLookup, type ILiveSharedDeck } from '../shared-deck-lookup';
import { SharedDeckMissingService } from '../shared-deck-missing.service';
import { computeShareImageHash, type IShareImageHashInput } from './share-image-hash';
import { buildPreviewDeck, type IPreviewFace } from './preview-deck';
import { buildPreviewMissing, describeMissingCount } from './preview-missing';
import { CardFaceFetcher } from './card-face-fetcher';
import { renderShareImage, type IShareImageInput } from './share-image-renderer';
import { SharePreviewStore, type IShareImageToStore } from './share-preview.store';
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

interface IImagePlan {
  readonly hashInput: Omit<IShareImageHashInput, 'drawnCardIdentifiers' | 'blockedCardIdentifiers'>;
  readonly faces: readonly IPreviewFace[];
  readonly emphasizeFirst: boolean;
  readonly fileSlug: string;
  readonly image: IShareImageInput;
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
    private readonly missingCards: SharedDeckMissingService,
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
    const key = `${live.link.id}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const started = this.produce(token, live).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, started);
    return started;
  }

  private async plan(token: string, live: ILiveSharedDeck): Promise<IImagePlan> {
    const { link, deck: trackedDeck, owner } = live;
    const rows = await this.deckCards.find({ where: { trackedDeckId: trackedDeck.id } });
    const shareUrl = `${this.baseUrl}/d/${token}`;

    if (link.intent === 'missing') {
      const missing = buildPreviewMissing(trackedDeck, owner, await this.missingCards.missingFor(owner.id, rows));
      return {
        faces: missing.faces,
        emphasizeFirst: missing.heroIsFirst,
        fileSlug: toFileSlug(missing.name),
        hashInput: {
          intent: 'missing',
          name: missing.name,
          hero: missing.hero,
          format: trackedDeck.format,
          sharerName: missing.sharerName,
          totalCards: 0,
          missingCount: missing.missingCount,
          shareUrl,
        },
        image: {
          kindLabel: 'Procuro',
          sharerName: missing.sharerName,
          title: missing.name,
          heroName: missing.hero,
          detail: describeMissingCount(missing.missingCount),
          shareAddress: addressWithoutScheme(shareUrl),
          legalLine: LEGAL_LINE,
          byLabel: 'por',
        },
      };
    }

    const deck = buildPreviewDeck(trackedDeck, owner, rows);
    return {
      faces: deck.faces,
      emphasizeFirst: true,
      fileSlug: toFileSlug(deck.name),
      hashInput: {
        intent: 'deck',
        name: deck.name,
        hero: deck.hero,
        format: deck.format,
        sharerName: deck.sharerName,
        totalCards: deck.totalCards,
        missingCount: 0,
        shareUrl,
      },
      image: {
        kindLabel: 'Deck',
        sharerName: deck.sharerName,
        title: deck.name,
        heroName: deck.hero,
        detail: `${deck.format} · ${deck.totalCards} cartas`,
        shareAddress: addressWithoutScheme(shareUrl),
        legalLine: LEGAL_LINE,
        byLabel: 'por',
      },
    };
  }

  private async produce(token: string, live: ILiveSharedDeck): Promise<IServedShareImage> {
    const plan = await this.plan(token, live);
    const shareLinkId = live.link.id;
    const drawn = plan.faces.map((face) => face.cardIdentifier);
    const blocked = await this.store.blockedAmong(drawn);
    const contentHash = computeShareImageHash({
      ...plan.hashInput,
      drawnCardIdentifiers: drawn,
      blockedCardIdentifiers: blocked,
    });

    const stored = await this.store.find(shareLinkId);
    if (stored?.contentHash === contentHash) return { jpeg: stored.jpeg, fileSlug: plan.fileSlug, complete: true };

    const visible = plan.faces.filter((face) => !blocked.includes(face.cardIdentifier));
    const fetched = await this.faceFetcher.fetchFaces(visible);
    const bufferById = new Map(visible.map((face, index) => [face.cardIdentifier, fetched[index] ?? null]));
    const faces = plan.faces.map((face) => bufferById.get(face.cardIdentifier) ?? null);
    const jpeg = await renderShareImage(plan.image, {
      faces,
      backdrop: faces[0] ?? null,
      emphasizeFirst: plan.emphasizeFirst,
    });

    const complete = visible.every((face) => bufferById.get(face.cardIdentifier));
    if (complete) {
      await this.saveBestEffort({
        shareLinkId,
        contentHash,
        cardIdentifiers: visible.map((face) => face.cardIdentifier),
        jpeg,
      });
    } else {
      this.logger.warn(`Share image for link ${shareLinkId} rendered with missing faces and not stored`);
    }
    return { jpeg, fileSlug: plan.fileSlug, complete };
  }

  // The link can be turned off while the image renders: the insert then fails on the foreign key, and the image is still served.
  private async saveBestEffort(image: IShareImageToStore): Promise<void> {
    try {
      await this.store.save(image);
    } catch (error) {
      this.logger.warn(
        `Share image for link ${image.shareLinkId} not stored: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
