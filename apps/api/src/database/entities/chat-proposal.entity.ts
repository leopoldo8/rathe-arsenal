import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CardReplacementEntity } from './card-replacement.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { TrackedDeckEntity } from './tracked-deck.entity';

export const CHAT_PROPOSAL_KINDS = ['deck', 'swap'] as const;
export type TChatProposalKind = (typeof CHAT_PROPOSAL_KINDS)[number];

export const CHAT_PROPOSAL_STATUSES = ['pending', 'applied', 'dismissed', 'stale'] as const;
export type TChatProposalStatus = (typeof CHAT_PROPOSAL_STATUSES)[number];

export interface IDeckProposalPayload {
  readonly name: string;
  readonly heroIdentifier: string;
  readonly format: string;
  readonly cards: readonly { readonly cardIdentifier: string; readonly quantity: number; readonly slot: string }[];
}

export type TSwapSide = 'deck' | 'inventory';

export interface ISwapProposalPayload {
  readonly trackedDeckId: number;
  readonly originalCardIdentifier: string;
  readonly slot: string;
  readonly replacementCardIdentifier: string;
  /** Copies the swap moves. Absent in a proposal stored before door 13: every copy the limit allows, from the deck. */
  readonly quantity?: number;
  readonly side?: TSwapSide;
  /** The deck's missing copies before the move and after it, fixed when the proposal was validated (door 13). */
  readonly missingBefore?: number;
  readonly missingAfter?: number;
}

@Check('CHK_chat_proposal_kind_valid', `"kind" IN ('deck', 'swap')`)
@Check('CHK_chat_proposal_status_valid', `"status" IN ('pending', 'applied', 'dismissed', 'stale')`)
@Entity({ name: 'chat_proposal' })
@Index('IDX_chat_proposal_message', ['messageId'])
export class ChatProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  messageId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: TChatProposalKind;

  @Column({ type: 'varchar', length: 16 })
  status!: TChatProposalStatus;

  @Column({ type: 'jsonb' })
  payload!: IDeckProposalPayload | ISwapProposalPayload;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'int', nullable: true })
  trackedDeckId!: number | null;

  @Column({ type: 'uuid', nullable: true })
  cardReplacementId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => ChatMessageEntity, { onDelete: 'CASCADE', deferrable: 'INITIALLY DEFERRED' })
  @JoinColumn({ name: 'messageId' })
  message!: ChatMessageEntity;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'SET NULL', nullable: true, deferrable: 'INITIALLY DEFERRED' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity | null;

  @ManyToOne(() => CardReplacementEntity, { onDelete: 'SET NULL', nullable: true, deferrable: 'INITIALLY DEFERRED' })
  @JoinColumn({ name: 'cardReplacementId' })
  cardReplacement!: CardReplacementEntity | null;
}
