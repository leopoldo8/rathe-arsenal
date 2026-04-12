import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Manual alias table that maps a (sourceSlug, rawName) pair to the
 * canonical cardIdentifier from @flesh-and-blood/cards.
 *
 * The card-name matcher consults this table before running the deterministic
 * kebab-transform (Stage 1), so a bad deterministic match can be corrected
 * without a code change. Phase 1b ships the table empty; rows are added by
 * the dev via direct SQL after reviewing unmatched product logs.
 *
 * Alias validation: before returning a hit, the matcher verifies the target
 * cardIdentifier still exists in the catalog. A stale alias (target removed
 * from a future catalog version) returns null with a warn-level log tagged
 * 'alias-target-missing'.
 */
@Entity({ name: 'card_alias' })
@Index(['sourceSlug', 'rawName'], { unique: true })
export class CardAliasEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Store slug identifying the source of the raw name.
   * Example: 'cupula-dt'
   */
  @Column({ type: 'varchar', length: 100 })
  sourceSlug!: string;

  /**
   * Raw product name exactly as scraped from the store.
   * Example: 'Hammer of Gravi, the Lightning Armory (Red)'
   */
  @Column({ type: 'varchar', length: 500 })
  rawName!: string;

  /**
   * Canonical card identifier from @flesh-and-blood/cards.
   * Example: 'hammer-of-gravi-the-lightning-armory-red'
   */
  @Column({ type: 'varchar', length: 150 })
  cardIdentifier!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Optional operator notes explaining why this alias exists. */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
