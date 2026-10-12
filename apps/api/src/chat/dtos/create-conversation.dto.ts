import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  trackedDeckId?: number;
}
