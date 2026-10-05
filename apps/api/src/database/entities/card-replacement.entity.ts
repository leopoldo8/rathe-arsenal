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
import { UserEntity } from './user.entity';
import { TrackedDeckEntity } from './tracked-deck.entity';

export const REPLACEMENT_STATUSES = ['active', 'kept', 'reverted', 'removed'] as const;
export type TReplacementStatus = (typeof REPLACEMENT_STATUSES)[number];

export const REPLACEMENT_PICK_ORIGINS = ['very_close', 'close', 'other_pitch', 'generic', 'search'] as const;
export type TReplacementPickOrigin = (typeof REPLACEMENT_PICK_ORIGINS)[number];

/**
 * Remembers one pick: the owner swapped the missing copies of
 * `originalCardIdentifier` in `slot` for `replacementCardIdentifier` (AD-009).
 * The deck list itself holds the replacement in `deck_card`; this row is the
 * only place the original survives, because every composition save deletes and
 * reinserts the `deck_card` rows.
 *
 * Rows are never deleted by code: `kept`, `reverted` and `removed` close the
 * record and set `resolvedAt`, and only the cascade from `user` or
 * `tracked_deck` removes one. There is no foreign key to `deck_card` for the
 * same reason (copies are tied by slot and replacement card identifier).
 *
 * `status` and `pickedFrom` are varchar plus a CHECK in the migration, as
 * `swap_suggestion.status` is, so a later value is a constraint replacement
 * and not a Postgres enum rebuild.
 */
@Check('CHK_card_replacement_status_valid', `status IN ('active', 'kept', 'reverted', 'removed')`)
@Check('CHK_card_replacement_picked_from_valid', `"pickedFrom" IN ('very_close', 'close', 'other_pitch', 'generic', 'search')`)
@Check('CHK_card_replacement_quantity_positive', `quantity > 0`)
@Entity({ name: 'card_replacement' })
@Index(['trackedDeckId', 'status'])
export class CardReplacementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar', length: 64 })
  slot!: string;

  @Column({ type: 'varchar', length: 128 })
  originalCardIdentifier!: string;

  @Column({ type: 'varchar', length: 128 })
  replacementCardIdentifier!: string;

  /** Copies moved from the original to the replacement; always above 0. */
  @Column({ type: 'int' })
  quantity!: number;

  /** The alternatives group the owner picked from; `search` for a name search. */
  @Column({ type: 'varchar', length: 32 })
  pickedFrom!: TReplacementPickOrigin;

  @Column({ type: 'varchar', length: 32 })
  status!: TReplacementStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Set when the status leaves `active`. */
  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
