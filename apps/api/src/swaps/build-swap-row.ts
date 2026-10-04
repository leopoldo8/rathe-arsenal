import { ICatalogCard, IRationaleDetail } from '@rathe-arsenal/engine';
import { CatalogService } from '../catalog/catalog.service';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';
import { describeSwapRationale } from './describe-swap-rationale';
import { lookupCardMeta } from './lookup-card-meta';
import { TSwapOutcome, TSwapRejectionReason, TSwapStatus } from './resolve-swap-transition';

type TPitch = 1 | 2 | 3;

export interface ISwapRow {
  readonly id: string;
  readonly trackedDeckId: number;
  readonly deckName: string;
  readonly hero: string;
  readonly cardIdentifier: string;
  readonly originalName: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
  readonly substituteName: string;
  readonly quantity: number;
  readonly ownedCount: number;
  readonly tier: 1 | 2;
  readonly confidence: number;
  readonly rationale: string;
  readonly rationaleDetail: IRationaleDetail | null;
  readonly status: TSwapStatus;
  readonly appliedAt: string | null;
  readonly rejectedAt: string | null;
  readonly rejectionReason: TSwapRejectionReason | null;
  readonly rejectionNote: string | null;
  readonly outcome: TSwapOutcome | null;
  readonly originalImageUrl: ICatalogCard['imageUrl'];
  readonly substituteImageUrl: ICatalogCard['imageUrl'];
  readonly originalPitch: TPitch | null;
  readonly substitutePitch: TPitch | null;
  readonly originalType: string;
  readonly substituteType: string;
}

export interface ISwapDeckMeta {
  readonly name: string;
  readonly hero: string;
}

export interface IBuildSwapRowInput {
  readonly entity: SwapSuggestionEntity;
  readonly deck: ISwapDeckMeta;
  readonly inventory: ReadonlyMap<string, number>;
  readonly catalogService: CatalogService;
}

function normalizePitch(pitch: number | null): TPitch | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

export function buildSwapRow({ entity, deck, inventory, catalogService }: IBuildSwapRowInput): ISwapRow {
  const original = lookupCardMeta(catalogService, entity.cardIdentifier);
  const substitute = lookupCardMeta(catalogService, entity.substituteIdentifier);

  return {
    id: entity.id,
    trackedDeckId: entity.trackedDeckId,
    deckName: deck.name,
    hero: deck.hero,
    cardIdentifier: entity.cardIdentifier,
    originalName: original.name,
    slot: entity.slot,
    substituteIdentifier: entity.substituteIdentifier,
    substituteName: substitute.name,
    quantity: entity.quantity,
    ownedCount: inventory.get(entity.substituteIdentifier) ?? 0,
    tier: entity.tier,
    confidence: entity.confidence,
    rationale: entity.rationale,
    rationaleDetail: describeSwapRationale(
      catalogService,
      entity.cardIdentifier,
      entity.substituteIdentifier,
      entity.tier,
    ),
    status: entity.status,
    appliedAt: entity.appliedAt?.toISOString() ?? null,
    rejectedAt: entity.rejectedAt?.toISOString() ?? null,
    rejectionReason: entity.rejectionReason,
    rejectionNote: entity.rejectionNote,
    outcome: entity.outcome,
    originalImageUrl: original.imageUrl,
    substituteImageUrl: substitute.imageUrl,
    originalPitch: normalizePitch(original.pitch),
    substitutePitch: normalizePitch(substitute.pitch),
    originalType: original.type,
    substituteType: substitute.type,
  };
}
