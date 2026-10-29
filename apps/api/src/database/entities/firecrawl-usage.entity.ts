import { Column, Entity, PrimaryColumn } from 'typeorm';

/** One row per UTC month (`YYYY-MM`) holding the Firecrawl credits the app spent in it. */
@Entity({ name: 'firecrawl_usage' })
export class FirecrawlUsageEntity {
  @PrimaryColumn({ type: 'char', length: 7 })
  month!: string;

  @Column({ type: 'int' })
  credits!: number;
}
