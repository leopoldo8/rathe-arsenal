import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

/**
 * An e-mail field every auth route reads the same way: trimmed and lowercased before validation,
 * so "Bia@Gmail.com " and "bia@gmail.com" reach the same account (door 14).
 */
export function NormalizedEmail(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail(),
  );
}
