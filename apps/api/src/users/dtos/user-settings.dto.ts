import { IsIn, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Inner DTO: closed-schema preferences shape.
 *
 * `@IsIn` enforces only `'dark'` or `'light'` are accepted — any other string
 * is rejected with a 400. The ValidationPipe is configured with
 * `whitelist: true` (globally in main.ts), so unknown keys on this object
 * are silently stripped before the value is persisted to the JSONB column.
 *
 * This prevents JSONB key-injection: e.g. `{ theme: 'dark', isAdmin: true }`
 * is stored as `{ theme: 'dark' }`.
 */
export class PreferencesDto {
  @IsIn(['dark', 'light'])
  theme!: 'dark' | 'light';
}

/**
 * Request body for PATCH /api/users/me/settings.
 * Unknown top-level keys are stripped by the global whitelist ValidationPipe.
 */
export class UserSettingsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences!: PreferencesDto;
}

/**
 * Flat request body for PATCH — accepts `{ theme }` directly rather than
 * `{ preferences: { theme } }`. This matches the frontend payload shape.
 */
export class PatchThemeDto {
  @IsIn(['dark', 'light'])
  theme!: 'dark' | 'light';
}
