import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CardListLineEntity } from './card-list-line.entity';
import { UserEntity } from './user.entity';

export type TListKind = 'want' | 'sell';

export const LIST_KINDS: readonly TListKind[] = ['want', 'sell'];

// numeric comes back from pg as a string.
const numericToNumber = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};

@Check('CHK_card_list_kind_valid', `"kind" IN ('want', 'sell')`)
@Check('CHK_card_list_total_price_valid', `"totalPriceCents" >= 0`)
@Check('CHK_card_list_price_multiplier_valid', `"priceMultiplier" > 0 AND "priceMultiplier" <= 50`)
@Index('IDX_card_list_userId', ['userId'])
@Entity({ name: 'card_list' })
export class CardListEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_card_list_userId' })
  user?: UserEntity;

  @Column({ type: 'varchar', length: 8 })
  kind!: TListKind;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'int', nullable: true })
  totalPriceCents!: number | null;

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true, transformer: numericToNumber })
  priceMultiplier!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('CardListLineEntity', 'list')
  lines?: CardListLineEntity[];
}
