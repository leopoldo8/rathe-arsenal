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

  /**
   * U12 — user preferences stored as a closed-schema JSONB blob.
   * The narrow shape `{ theme: 'dark' | 'light' }` is enforced at the DTO
   * layer (UserSettingsDto with class-validator). TypeORM writes the raw
   * record; the column default is set by migration 1776621087000.
   *
   * Nullable here so existing rows loaded before the migration has run (or
   * rows that somehow have NULL) do not cause a runtime crash. The auth
   * service uses `preferences?.theme ?? 'dark'` as a defensive fallback.
   */
  @Column({ type: 'jsonb', nullable: true, default: () => `'{"theme":"dark"}'` })
  preferences!: { theme: 'dark' | 'light' } | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
