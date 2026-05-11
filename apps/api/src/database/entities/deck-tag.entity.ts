import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * User-defined free-form tag for categorizing tracked decks (R3a, R5, R12a).
 *
 * Design decisions:
 * - `name` is capped at 24 characters; enforcement is at the DTO layer
 *   (@MaxLength(24)) and at the DB column level (varchar(24)).
 * - Case-insensitive uniqueness per user is enforced by the expression index
 *   on (userId, LOWER(name)) created in migration T+3000.
 * - Serial int PK (not UUID) matches the TrackedDeckEntity pattern.
 * - CASCADE delete on the userId FK cleans up all user tags when the user is removed.
 *
 * The name field does NOT carry the expression index as a TypeORM @Index decorator
 * (TypeORM does not support functional index expressions on a single column).
 * The migration creates the index with raw SQL.
 */
@Entity({ name: 'deck_tag' })
@Index(['userId'])
export class DeckTagEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 24 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
