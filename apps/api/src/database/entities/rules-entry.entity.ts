import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'rules_entry' })
export class RulesEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('UQ_rules_entry_rule_number', { unique: true })
  @Column({ type: 'varchar', length: 128 })
  ruleNumber!: string;

  @Column({ type: 'varchar', length: 16 })
  sectionNumber!: string;

  @Column({ type: 'varchar', length: 255 })
  sectionTitle!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'varchar', length: 255 })
  url!: string;

  @Column({ type: 'varchar', length: 64 })
  sourceHash!: string;

  @Column({ type: 'timestamptz' })
  fetchedAt!: Date;
}
