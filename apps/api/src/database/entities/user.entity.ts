import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TSpareRule = 'within_format' | 'any_deck' | 'per_deck';

export const SPARE_RULES: readonly TSpareRule[] = ['within_format', 'any_deck', 'per_deck'];

export type TReferredVia = 'deck' | 'want' | 'sell' | 'quote';

/**
 * Authorization role. `admin` unlocks owner/operator surfaces (e.g. the manual
 * store URL-sync trigger). Promote a user by setting this column — there is no
 * env allowlist. Default `user`.
 */
export enum EUserRole {
  User = 'user',
  Admin = 'admin',
}

/**
 * User entity. Locked here as part of the Clerk → DIY auth swap so the
 * AuthService can rely on the columns. Phase 0 plan Unit 2 originally
 * specified `id` as Clerk's userId string; the swap plan replaces that
 * with an app-generated UUID.
 *
 * Token columns hold sha256 hashes of the raw tokens — the raw token is
 * sent in the email link only, never stored.
 */
@Check('CHK_user_referred_via_valid', `"referredVia" IN ('deck', 'want', 'sell', 'quote')`)
@Check('CHK_user_spare_rule_valid', `"spareRule" IS NULL OR "spareRule" IN ('within_format', 'any_deck', 'per_deck')`)
// Unique on the lowercased address (door 14), `IDX_user_email_lower`. TypeORM cannot declare an
// expression index: the migration creates it in production and `DatabaseModule` creates it where
// the schema is synchronized (the schema sync does not read expression indexes, so it leaves it be).
@Entity({ name: 'user' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Authorization role (see EUserRole). Column default lives in the migration. */
  @Column({ type: 'varchar', length: 20, default: EUserRole.User })
  role!: EUserRole;

  /** Set only by the `chat:grant` script; never from a user-writable route (AD-013). */
  @Column({ type: 'boolean', default: false })
  chatAccess!: boolean;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  /** Null for an account that signs in with an e-mailed code only (door 14). */
  @Column({ type: 'varchar', length: 60, nullable: true })
  passwordHash!: string | null;

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
   * layer (PatchThemeDto with class-validator).
   *
   * Default value lives in migration 1776621087000 (`DEFAULT '{"theme":"dark"}'::jsonb`).
   * The entity intentionally omits a `default` attribute — duplicating it here
   * at the ORM layer risks drift with the DDL (TypeORM's function-expression
   * defaults use different syntax than raw Postgres). Service code uses
   * `preferences?.theme ?? 'dark'` as the runtime fallback when the column
   * is NULL on a malformed row.
   */
  @Column({ type: 'jsonb', nullable: true })
  preferences!: { theme: 'dark' | 'light' } | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  whatsappNumber!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'referredByUserId', foreignKeyConstraintName: 'FK_user_referredByUserId' })
  referredBy?: UserEntity | null;

  @Column({ type: 'uuid', nullable: true })
  referredByUserId!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  referredVia!: TReferredVia | null;

  /** The last closing line the owner sent in a group ask, offered again next time. */
  @Column({ type: 'varchar', length: 140, nullable: true })
  shareClosingLine!: string | null;

  /** Door 12: how the player passes cards between decks; null until the player answers. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  spareRule!: TSpareRule | null;

  /** The last closing line of a sell message, in full, offered again in the next draft. */
  @Column({ type: 'varchar', length: 140, nullable: true })
  sellClosingLine!: string | null;

  /** The in-app page the visitor signed up from, so confirming the e-mail can send them back to it on any device. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  signupReturnPath!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
