import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatMessageEntity } from './chat-message.entity';
import { UserEntity } from './user.entity';

/** Survives conversation deletion: the monthly budget sums these rows, never chat_message. */
@Entity({ name: 'chat_usage' })
@Index('IDX_chat_usage_user_created', ['userId', 'createdAt'])
export class ChatUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  messageId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  model!: string;

  @Column({ type: 'int' })
  inputTokens!: number;

  @Column({ type: 'int' })
  outputTokens!: number;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  costUsd!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => ChatMessageEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'messageId' })
  message!: ChatMessageEntity | null;
}
