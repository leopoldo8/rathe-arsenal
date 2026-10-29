import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TSignInCodePurpose = 'sign_in' | 'password';

/**
 * One e-mailed code per address and purpose (door 15): a sign-in code, or the code that guards a
 * password change. A new request marks the live row consumed, so
 * the partial unique index holds at most one live code per address while old rows stay for the
 * per-address request limit and the housekeeping purge.
 */
@Index('IDX_sign_in_code_one_live', ['email', 'purpose'], { unique: true, where: '"consumedAt" IS NULL' })
@Check('CHK_sign_in_code_purpose_valid', `"purpose" IN ('sign_in', 'password')`)
@Index('IDX_sign_in_code_button_token', ['buttonTokenHash'], { unique: true })
@Entity({ name: 'sign_in_code' })
export class SignInCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 16, default: 'sign_in' })
  purpose!: TSignInCodePurpose;

  /** HMAC of the six digits, keyed by the server secret: a bare hash of six digits could be guessed offline. */
  @Column({ type: 'varchar', length: 64 })
  codeHash!: string;

  /** sha256 of the single-use token the e-mail's button carries. */
  @Column({ type: 'varchar', length: 64 })
  buttonTokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
