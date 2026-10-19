import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CardArtBlockEntity } from '../../database/entities/card-art-block.entity';
import { ShareImageEntity } from '../../database/entities/share-image.entity';
import type { TShareTargetKind } from '../../database/entities/share-event.entity';

export interface IStoredShareImage {
  readonly contentHash: string;
  readonly jpeg: Buffer;
}

export interface IShareImageToStore {
  readonly targetKind: TShareTargetKind;
  readonly targetId: number;
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

  async find(targetKind: TShareTargetKind, targetId: number): Promise<IStoredShareImage | null> {
    const row = await this.images.findOne({
      where: { targetKind, targetId },
      select: { contentHash: true, jpeg: true },
    });
    return row ? { contentHash: row.contentHash, jpeg: row.jpeg } : null;
  }

  async save(image: IShareImageToStore): Promise<void> {
    await this.images.upsert(
      {
        targetKind: image.targetKind,
        targetId: image.targetId,
        contentHash: image.contentHash,
        cardIdentifiers: [...image.cardIdentifiers],
        jpeg: image.jpeg,
        createdAt: new Date(),
      },
      ['targetKind', 'targetId'],
    );
  }

  async deleteFor(targetKind: TShareTargetKind, targetId: number): Promise<void> {
    await this.images.delete({ targetKind, targetId });
  }

  async blockedAmong(cardIdentifiers: readonly string[]): Promise<string[]> {
    if (cardIdentifiers.length === 0) return [];
    const rows = await this.blocks.find({ where: { cardIdentifier: In([...cardIdentifiers]) } });
    return rows.map((row) => row.cardIdentifier);
  }
}
