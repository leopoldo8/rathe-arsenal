import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { CsvSourceEntity } from './csv-source.entity';
import { ICopyVersion } from '../../collection/versions/copy-version';

/**
 * Represents a card in a user's collection with its quantity.
 * The `cardIdentifier` maps to the `@flesh-and-blood/cards` string id.
 *
 * Plan B (U1+U2): each row now belongs to exactly one `CsvSourceEntity`
 * via the `sourceId` FK (NOT NULL). The old `(userId, cardIdentifier)`
 * unique index has been replaced by `(userId, cardIdentifier, sourceId)`
 * so the same card can exist under multiple sources; Library totals are
 * computed at read time as `SUM(quantity)` across active sources.
 *
 * Door 1 (persona rethink): a copy may carry a version, four varchar columns
 * where `''` means "Não sei". The key is the seven columns, never nullable,
 * so `ON CONFLICT` fires for copies with no version too.
 */
@Check('CHK_collection_card_edition_valid', `"edition" IN ('', 'first', 'unlimited', 'alpha')`)
@Check('CHK_collection_card_finish_valid', `"finish" IN ('', 'none', 'rainbow', 'cold', 'gold')`)
@Check('CHK_collection_card_condition_valid', `"condition" IN ('', 'NM', 'LP', 'MP', 'HP', 'DMG')`)
@Entity({ name: 'collection_card' })
@Index(
  'IDX_collection_card_user_card_source_version_uq',
  ['userId', 'cardIdentifier', 'sourceId', 'printingCode', 'edition', 'finish', 'condition'],
  { unique: true },
)
export class CollectionCardEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  cardIdentifier!: string;

  /**
   * FK to `csv_source`. Every row is owned by a source — either the
   * lazy-created `kind='manual'` source or a `kind='csv'` upload.
   * NOT NULL: enforced by migration; entity reflects the DB constraint.
   */
  @Column({ type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'varchar', default: '' })
  printingCode!: string;

  @Column({ type: 'varchar', default: '' })
  edition!: ICopyVersion['edition'];

  @Column({ type: 'varchar', default: '' })
  finish!: ICopyVersion['finish'];

  @Column({ type: 'varchar', default: '' })
  condition!: ICopyVersion['condition'];

  @Column({ type: 'int' })
  quantity!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastUpdated!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => CsvSourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceId' })
  source!: CsvSourceEntity;
}
