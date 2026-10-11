import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TrackedDeckEntity } from './tracked-deck.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'chat_conversation' })
@Index('IDX_chat_conversation_user_updated', ['userId', 'updatedAt'])
export class ChatConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int', nullable: true })
  trackedDeckId!: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  title!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', deferrable: 'INITIALLY DEFERRED' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'SET NULL', nullable: true, deferrable: 'INITIALLY DEFERRED' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity | null;
}
