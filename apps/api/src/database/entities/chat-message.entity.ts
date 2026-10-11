import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatConversationEntity } from './chat-conversation.entity';

export const CHAT_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type TChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const CHAT_MESSAGE_STATUSES = ['pending', 'running', 'done', 'failed'] as const;
export type TChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];

export const CHAT_TURN_FAILURE_CODES = [
  'BUDGET_EXHAUSTED',
  'NO_API_KEY',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_ERROR',
  'MODEL_TIMEOUT',
  'TURN_TIMEOUT',
  'MODEL_REFUSED',
  'MODEL_TRUNCATED',
  'MODEL_BAD_TOOL_CALL',
  'TOO_MANY_TOOL_ROUNDS',
  'HISTORY_REJECTED',
  'MODEL_EMPTY',
  'WORKER_LOST',
] as const;
export type TChatTurnFailureCode = (typeof CHAT_TURN_FAILURE_CODES)[number];

// Indexes and CHECKs repeat the migration's: local databases are built by `synchronize`.
@Check('CHK_chat_message_role_valid', `"role" IN ('user', 'assistant')`)
@Check('CHK_chat_message_status_valid', `"status" IN ('pending', 'running', 'done', 'failed')`)
@Entity({ name: 'chat_message' })
@Index('IDX_chat_message_conversation_created', ['conversationId', 'createdAt'])
@Index('IDX_chat_message_status_created', ['status', 'createdAt'])
@Index('IDX_chat_message_one_open_turn', ['conversationId'], {
  unique: true,
  where: `"status" IN ('pending', 'running')`,
})
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: TChatMessageRole;

  @Column({ type: 'varchar', length: 16 })
  status!: TChatMessageStatus;

  @Column({ type: 'text', nullable: true })
  text!: string | null;

  /** Replayed to the model byte for byte: never rebuild or reorder its parts. */
  @Column({ type: 'jsonb', nullable: true })
  modelContent!: unknown[] | null;

  @Column({ type: 'varchar', length: 8 })
  locale!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  error!: TChatTurnFailureCode | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'int', nullable: true })
  inputTokens!: number | null;

  @Column({ type: 'int', nullable: true })
  outputTokens!: number | null;

  /** The pg driver returns numeric as a string. */
  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  costUsd!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => ChatConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: ChatConversationEntity;
}
