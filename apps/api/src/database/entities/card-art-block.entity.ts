import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Cards whose faces must never be drawn in a generated share image (takedown requests). */
@Entity({ name: 'card_art_block' })
export class CardArtBlockEntity {
  @PrimaryColumn({ type: 'varchar' })
  cardIdentifier!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
