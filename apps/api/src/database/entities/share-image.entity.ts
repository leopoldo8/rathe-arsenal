import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ShareLinkEntity } from './share-link.entity';

// The GIN index on cardIdentifiers (IDX_share_image_cardIdentifiers) exists only in the
// migration: TypeORM 0.3 cannot declare a GIN index, so `synchronize` does not create it.
@Index('IDX_share_image_shareLinkId', ['shareLinkId'], { unique: true })
@Entity({ name: 'share_image' })
export class ShareImageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  shareLinkId!: number;

  // Turning a link off or deleting its owner removes the image through this cascade.
  @ManyToOne(() => ShareLinkEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shareLinkId', foreignKeyConstraintName: 'FK_share_image_shareLinkId' })
  shareLink?: ShareLinkEntity;

  @Column({ type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ type: 'text', array: true })
  cardIdentifiers!: string[];

  @Column({ type: 'bytea' })
  jpeg!: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
