import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { LibraryService } from './library.service';
import { ILibraryResponse } from './dtos/library-response.dto';

/**
 * GET /api/collection/library
 *
 * Returns the authenticated user's full collection library with per-card
 * metadata (name, pitch, types, classes, sets, imageUrl, ownedQuantity) and
 * aggregate stats (uniqueCount, totalCopies, pitchBreakdown,
 * estimatedValueCents, pricedIdentifierCount, priceDataLastUpdatedAt).
 *
 * Endpoint lives under /api/collection/* to preserve the CollectionModule
 * boundary. Authentication is enforced globally by JwtAuthGuard.
 */
@Controller('collection/library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  async getLibrary(
    @CurrentUser() user: ICurrentUser,
  ): Promise<ILibraryResponse> {
    return this.libraryService.load(user.userId);
  }
}
