import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CardArtBlockEntity } from '../../database/entities/card-art-block.entity';
import { ShareImageEntity } from '../../database/entities/share-image.entity';

export interface IStoredShareImage {
  readonly contentHash: string;
  readonly jpeg: Buffer;
}

export interface IShareImageToStore {
  readonly shareLinkId: number;
  readonly contentHash: string;
  readonly cardIdentifiers: readonly string[];
  readonly jpeg: Buffer;
}

@Injectable()
export class SharePreviewStore {
  constructor(
    @InjectRepository(ShareImageEntity)
    private readonly images: Repository<ShareImageEntity>,
    @InjectRepository(CardArtBlockEntity)
    private readonly blocks: Repository<CardArtBlockEntity>,
  ) {}

  async find(shareLinkId: number): Promise<IStoredShareImage | null> {
    const row = await this.images.findOne({
      where: { shareLinkId },
      select: { contentHash: true, jpeg: true },
    });
    return row ? { contentHash: row.contentHash, jpeg: row.jpeg } : null;
  }

  async save(image: IShareImageToStore): Promise<void> {
    await this.images.upsert(
      {
        shareLinkId: image.shareLinkId,
        contentHash: image.contentHash,
        cardIdentifiers: [...image.cardIdentifiers],
        jpeg: image.jpeg,
        createdAt: new Date(),
      },
      ['shareLinkId'],
    );
  }

  async blockedAmong(cardIdentifiers: readonly string[]): Promise<string[]> {
    if (cardIdentifiers.length === 0) return [];
    const rows = await this.blocks.find({ where: { cardIdentifier: In([...cardIdentifiers]) } });
    return rows.map((row) => row.cardIdentifier);
  }
}
