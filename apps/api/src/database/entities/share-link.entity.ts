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
import type { TShareTargetKind } from './share-event.entity';
import { UserEntity } from './user.entity';

export type TShareIntent = 'deck' | 'missing' | 'want' | 'sell' | 'quote';
export type TDeckShareIntent = 'deck' | 'missing' | 'quote';

export const DECK_SHARE_INTENTS: readonly TDeckShareIntent[] = ['deck', 'missing', 'quote'];

@Check('CHK_share_link_target_kind_valid', `"targetKind" IN ('deck', 'list')`)
@Check('CHK_share_link_intent_valid', `"intent" IN ('deck', 'missing', 'want', 'sell', 'quote')`)
@Index('IDX_share_link_token', ['token'], { unique: true })
@Index('IDX_share_link_target_intent', ['targetKind', 'targetId', 'intent'], { unique: true })
@Entity({ name: 'share_link' })
export class ShareLinkEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  token!: string;

  @Column({ type: 'varchar', length: 8 })
  targetKind!: TShareTargetKind;

  // No foreign key (the target is a deck or a list): the deck delete path and the user delete scripts remove the rows.
  @Column({ type: 'int' })
  targetId!: number;

  @Column({ type: 'varchar', length: 16 })
  intent!: TShareIntent;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId', foreignKeyConstraintName: 'FK_share_link_ownerUserId' })
  owner?: UserEntity;

  @Column({ type: 'boolean', default: true })
  showsContact!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
