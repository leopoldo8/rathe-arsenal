import { IsIn } from 'class-validator';

/**
 * Request body for PATCH /api/users/me/settings.
 *
 * Flat shape (`{ theme }`) matches the frontend payload. `@IsIn` enforces
 * only `'dark'` or `'light'` are accepted — any other string returns 400.
 * The global ValidationPipe is configured with `whitelist: true`, so unknown
 * top-level keys are silently stripped before persistence — this prevents
 * silent JSONB key-injection as the `preferences` column expands (e.g. a
 * client sending `{ theme: 'dark', isAdmin: true }` stores only `{ theme }`).
 */
export class PatchThemeDto {
  @IsIn(['dark', 'light'])
  theme!: 'dark' | 'light';
}
