import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Shared snapshot of TCGplayer prices in USD cents, written only by the price job. */
@Entity({ name: 'card_price' })
export class CardPriceEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  productId!: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  subType!: string;

  @Column({ type: 'int', nullable: true })
  marketPriceCents!: number | null;

  @Column({ type: 'int', nullable: true })
  midPriceCents!: number | null;

  @Column({ type: 'timestamptz' })
  fetchedAt!: Date;
}
