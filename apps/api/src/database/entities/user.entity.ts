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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
