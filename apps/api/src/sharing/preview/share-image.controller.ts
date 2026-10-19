import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { ShareImageService } from './share-image.service';

const IMAGE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
const STABLE_CACHE_CONTROL = 'public, max-age=300';
const DEGRADED_CACHE_CONTROL = 'public, max-age=60';

type TServedImage = Awaited<ReturnType<ShareImageService['imageForToken']>>;

function sendImage(response: Response, served: TServedImage, download: string | undefined): StreamableFile {
  response.setHeader('Content-Type', 'image/jpeg');
  response.setHeader('Cache-Control', served.complete ? STABLE_CACHE_CONTROL : DEGRADED_CACHE_CONTROL);
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (download === '1') {
    response.setHeader('Content-Disposition', `attachment; filename="${served.fileSlug}.jpg"`);
  }
  return new StreamableFile(served.jpeg);
}

@Public()
@Controller('shared/decks')
export class ShareImageController {
  constructor(private readonly images: ShareImageService) {}

  // Never counted as an open: only the JSON API records opens.
  @Get(':token/image')
  @Throttle(IMAGE_THROTTLE)
  async image(
    @Param('token') token: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return sendImage(response, await this.images.imageForToken(token), download);
  }
}

@Public()
@Controller('shared/lists')
export class ShareListImageController {
  constructor(private readonly images: ShareImageService) {}

  // Never counted as an open: only the JSON API records opens.
  @Get(':token/image')
  @Throttle(IMAGE_THROTTLE)
  async image(
    @Param('token') token: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return sendImage(response, await this.images.imageForListToken(token), download);
  }
}
