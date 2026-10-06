import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RecommendationRunEntity } from './recommendation-run.entity';

export const RECOMMENDATION_STRENGTHS = ['clear_upgrade', 'consider'] as const;
export type TRecommendationStrength = (typeof RECOMMENDATION_STRENGTHS)[number];

export const RECOMMENDATIONS_PER_RUN = 10;

@Check('CHK_recommendation_rank_range', `"rank" BETWEEN 1 AND 10`)
@Check('CHK_recommendation_strength_valid', `"strength" IN ('clear_upgrade', 'consider')`)
@Entity({ name: 'recommendation' })
@Index('IDX_recommendation_run_rank', ['runId', 'rank'], { unique: true })
export class RecommendationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  runId!: string;

  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'varchar', length: 16 })
  strength!: TRecommendationStrength;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cutCardIdentifier!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  cutSlot!: string | null;

  @Column({ type: 'text' })
  reason!: string;

  @ManyToOne(() => RecommendationRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runId' })
  run!: RecommendationRunEntity;
}
