import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * One signed-in browser (door 17). The cookie carries an opaque token; only its sha256 is stored, so
 * a copy of this table cannot sign anyone in. A row stays after "Sair" with `revokedAt` set, until
 * the housekeeping purge removes it.
 */
@Index('IDX_user_session_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_user_session_user', ['userId'])
@Entity({ name: 'user_session' })
export class UserSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_user_session_userId' })
  user?: UserEntity;

  /** sha256 of the cookie's token, hex-encoded. */
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Moved forward at most once a day; the cookie is sent again each time it moves. */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
