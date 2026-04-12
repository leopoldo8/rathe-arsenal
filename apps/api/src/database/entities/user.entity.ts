import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * User entity. Locked here as part of the Clerk → DIY auth swap so the
 * AuthService can rely on the columns. Phase 0 plan Unit 2 originally
 * specified `id` as Clerk's userId string; the swap plan replaces that
 * with an app-generated UUID.
 *
 * Token columns hold sha256 hashes of the raw tokens — the raw token is
 * sent in the email link only, never stored.
 */
@Entity({ name: 'user' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 60 })
  passwordHash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  verificationTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verificationTokenExpiresAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  passwordResetTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetTokenExpiresAt!: Date | null;

  /**
   * Soft-delete marker. Set by `AuthService.deleteAccount()` (Phase 1a Unit 2).
   * `JwtStrategy.validate()` rejects users with a non-null value on the same
   * per-request DB lookup, so deleted users lose access immediately without
   * adding a second query. The 30-day purge in `scripts/purge-deleted-users.ts`
   * removes rows whose `deletedAt < now() - 30 days`.
   */
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
