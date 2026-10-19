import { Column, Entity, PrimaryColumn } from 'typeorm';

/** One row per tcgcsv group (set) the job read, so it never reads a group twice in one UTC day. */
@Entity({ name: 'card_price_group_sync' })
export class CardPriceGroupSyncEntity {
  @PrimaryColumn({ type: 'int' })
  groupId!: number;

  @Column({ type: 'timestamptz' })
  fetchedAt!: Date;
}
