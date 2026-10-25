import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import { SPARE_RULES, TSpareRule } from '../../database/entities/user.entity';

export class UpdateSpareRuleDto {
  // The raw value, so a missing body or null is refused instead of stored.
  @Transform(({ obj }: { obj: { rule?: unknown } }) => obj.rule)
  @IsIn(SPARE_RULES)
  rule!: TSpareRule;
}
