import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CsvSourceEntity } from './csv-source.entity';
import { UserEntity } from './user.entity';

export const PENDING_REASONS = ['asks_color', 'suggestion', 'not_found', 'bad_quantity'] as const;
export type TPendingReason = (typeof PENDING_REASONS)[number];

/**
 * A line of a paste or file that was not ready when the import was added (door 7): it keeps its
 * import, its line number and the text the player wrote, until the player resolves or deletes it.
 * It goes with its import (`ON DELETE CASCADE`).
 */
@Entity({ name: 'import_pending_line' })
@Index('IDX_import_pending_line_sourceId', ['sourceId'])
@Index('IDX_import_pending_line_userId', ['userId'])
export class ImportPendingLineEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  lineNumber!: number;

  @Column({ type: 'text' })
  originalText!: string;

  @Column({ type: 'varchar', length: 32 })
  reason!: TPendingReason;

  /** The card a near name pointed at, so "Resolver" can offer it again. */
  @Column({ type: 'varchar', nullable: true })
  suggestedCardIdentifier!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => CsvSourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceId' })
  source!: CsvSourceEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
