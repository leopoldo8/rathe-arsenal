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
 * A deck imported from Fabrary that the user wants to track for readiness.
 * The `fabraryUlid` is the deck's unique identifier on Fabrary.
 */
@Entity({ name: 'tracked_deck' })
@Index(['userId', 'fabraryUlid'], { unique: true })
export class TrackedDeckEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  fabraryUlid!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  hero!: string;

  @Column({ type: 'varchar' })
  format!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  trackedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
