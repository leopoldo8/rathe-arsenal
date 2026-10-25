import { IsIn, IsOptional } from 'class-validator';

export const COPY_VARIANTS = ['original', 'as_built'] as const;
export type TCopyVariant = (typeof COPY_VARIANTS)[number];

/**
 * Which list a visitor saves from a deck with substitutions: the sharer's list before the picks, or the deck as built.
 * A deck with no active substitution needs none.
 */
export class CopyDeckDto {
  @IsOptional()
  @IsIn(COPY_VARIANTS)
  variant?: TCopyVariant;
}
