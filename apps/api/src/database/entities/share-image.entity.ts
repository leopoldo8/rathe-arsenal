import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { TShareTargetKind } from './share-event.entity';

// The GIN index on cardIdentifiers (IDX_share_image_cardIdentifiers) exists only in the
// migration: TypeORM 0.3 cannot declare a GIN index, so `synchronize` does not create it.
@Index('IDX_share_image_target', ['targetKind', 'targetId'], { unique: true })
@Entity({ name: 'share_image' })
export class ShareImageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 8 })
  targetKind!: TShareTargetKind;

  // No foreign key: the deck delete path and the purge script remove the row.
  @Column({ type: 'int' })
  targetId!: number;

  @Column({ type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ type: 'text', array: true })
  cardIdentifiers!: string[];

  @Column({ type: 'bytea' })
  jpeg!: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
