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
import { CardListEntity } from './card-list.entity';

export type TCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

export const CONDITIONS: readonly TCondition[] = ['NM', 'LP', 'MP', 'HP', 'DMG'];

@Check('CHK_card_list_line_quantity_valid', `"quantity" BETWEEN 1 AND 20`)
@Check('CHK_card_list_line_condition_valid', `"condition" IN ('NM', 'LP', 'MP', 'HP', 'DMG')`)
@Check('CHK_card_list_line_price_valid', `"priceCents" >= 0`)
@Index('IDX_card_list_line_listId', ['listId'])
@Entity({ name: 'card_list_line' })
export class CardListLineEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  listId!: number;

  @ManyToOne(() => CardListEntity, (list) => list.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId', foreignKeyConstraintName: 'FK_card_list_line_listId' })
  list?: CardListEntity;

  @Column({ type: 'varchar' })
  cardIdentifier!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'varchar', nullable: true })
  printing!: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  condition!: TCondition | null;

  @Column({ type: 'int', nullable: true })
  priceCents!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  soldAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
