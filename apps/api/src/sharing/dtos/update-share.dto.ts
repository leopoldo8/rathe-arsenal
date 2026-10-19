import { IsBoolean } from 'class-validator';

export class UpdateShareDto {
  @IsBoolean()
  showContact!: boolean;
}
