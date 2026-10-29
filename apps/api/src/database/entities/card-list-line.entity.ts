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
// Renamed from CHK_card_list_line_condition_valid: synchronize compares checks by name only, so a
// database built before door 1 would keep the old expression, which refuses ''.
@Check('CHK_card_list_line_condition_values', `"condition" IN ('', 'NM', 'LP', 'MP', 'HP', 'DMG')`)
@Check('CHK_card_list_line_edition_valid', `"edition" IN ('', 'first', 'unlimited', 'alpha')`)
@Check('CHK_card_list_line_finish_valid', `"finish" IN ('', 'none', 'rainbow', 'cold', 'gold')`)
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

  // Door 1: the four version fields hold '' for "Não sei". `printing` stays until the slice that
  // moves the sell lines onto the four fields (S21) stops writing it.
  @Column({ type: 'varchar', default: '' })
  printingCode!: string;

  @Column({ type: 'varchar', default: '' })
  edition!: '' | 'first' | 'unlimited' | 'alpha';

  @Column({ type: 'varchar', default: '' })
  finish!: '' | 'none' | 'rainbow' | 'cold' | 'gold';

  // The column is NOT NULL with '' for "Não sei" (door 1); the lists code keeps saying null until the
  // sell lines move onto the four fields (S21), so the transformer maps between the two.
  @Column({
    type: 'varchar',
    length: 4,
    default: '',
    transformer: {
      to: (value: TCondition | null | undefined): TCondition | '' => value ?? '',
      from: (value: TCondition | ''): TCondition | null => (value === '' ? null : value),
    },
  })
  condition!: TCondition | null;

  @Column({ type: 'int', nullable: true })
  priceCents!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  soldAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
