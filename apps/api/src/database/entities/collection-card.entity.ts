import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * Represents a card in a user's collection with its quantity.
 * The `cardIdentifier` maps to the `@flesh-and-blood/cards` string id.
 */
@Entity({ name: 'collection_card' })
@Index(['userId', 'cardIdentifier'], { unique: true })
export class CollectionCardEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  cardIdentifier!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastUpdated!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
