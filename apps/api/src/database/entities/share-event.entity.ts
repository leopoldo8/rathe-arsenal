import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TShareIntent } from './share-link.entity';
import { UserEntity } from './user.entity';

export type TShareEventKind = 'created' | 'opened' | 'signed_up' | 'offer' | 'quote_sent' | 'buy';
export type TShareTargetKind = 'deck' | 'list';

@Check('CHK_share_event_kind_valid', `"kind" IN ('created', 'opened', 'signed_up', 'offer', 'quote_sent', 'buy')`)
@Check('CHK_share_event_target_kind_valid', `"targetKind" IN ('deck', 'list')`)
@Check('CHK_share_event_intent_valid', `"intent" IS NULL OR "intent" IN ('deck', 'missing', 'want', 'sell', 'quote')`)
@Index('IDX_share_event_kind_occurredAt', ['kind', 'occurredAt'])
@Entity({ name: 'share_event' })
export class ShareEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: TShareEventKind;

  @Column({ type: 'varchar', length: 8 })
  targetKind!: TShareTargetKind;

  // No foreign key: events must outlive the deck or list they measured.
  @Column({ type: 'int' })
  targetId!: number;

  // Null on events recorded before links had an intent.
  @Column({ type: 'varchar', length: 16, nullable: true })
  intent!: TShareIntent | null;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId', foreignKeyConstraintName: 'FK_share_event_ownerUserId' })
  owner?: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorUserId', foreignKeyConstraintName: 'FK_share_event_actorUserId' })
  actor?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;
}
