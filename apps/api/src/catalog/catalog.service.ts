import { Injectable } from '@nestjs/common';
import {
  catalog,
  ICatalog,
  ICatalogCard,
  ICatalogIndices,
} from '@rathe-arsenal/engine';

@Injectable()
export class CatalogService {
  private readonly catalog: ICatalog = catalog;

  getCard(identifier: string): ICatalogCard {
    return this.catalog.getCard(identifier);
  }

  getCards(): readonly ICatalogCard[] {
    return this.catalog.cards;
  }

  getIndices(): ICatalogIndices {
    return this.catalog.indices;
  }

  getRawCard(identifier: string): unknown {
    return this.catalog.getRawCard(identifier);
  }
}
