import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One e-mailed sign-in code per address (door 15). A new request marks the live row consumed, so
 * the partial unique index holds at most one live code per address while old rows stay for the
 * per-address request limit and the housekeeping purge.
 */
@Index('IDX_sign_in_code_one_live', ['email'], { unique: true, where: '"consumedAt" IS NULL' })
@Index('IDX_sign_in_code_button_token', ['buttonTokenHash'], { unique: true })
@Entity({ name: 'sign_in_code' })
export class SignInCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

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
