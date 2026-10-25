import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { ISpareResponse } from './dtos/spare-response.dto';
import { SpareViewService } from './spare-view.service';

/** GET /api/collection/spare: the spare copies of the signed-in player, computed on every read. */
@Controller('collection/spare')
export class SpareController {
  constructor(private readonly view: SpareViewService) {}

  @Get()
  async read(@CurrentUser() user: ICurrentUser): Promise<ISpareResponse> {
    return this.view.read(user.userId);
  }
}
