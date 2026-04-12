import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum ENodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvDto {
  @IsEnum(ENodeEnv)
  NODE_ENV!: ENodeEnv;

  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters (use `openssl rand -hex 32`)' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+[smhd]$/, { message: 'JWT_EXPIRES_IN must look like "7d", "12h", "30m"' })
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY!: string;

  // Resend accepts both `noreply@example.com` and `Display Name <noreply@example.com>`.
  // Validated as a non-empty string (not @IsEmail) so the friendlier "Name <email>" form is allowed.
  @IsString()
  @IsNotEmpty()
  EMAIL_FROM!: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  APP_BASE_URL!: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  AWS_APPSYNC_ENDPOINT: string =
    'https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql';

  @IsOptional()
  @IsString()
  COGNITO_IDENTITY_POOL_ID: string = 'us-east-2:e50f3ed7-32ed-4b22-a05e-10b3e7e03fe0';

  @IsOptional()
  @IsString()
  COGNITO_REGION: string = 'us-east-2';

  @IsOptional()
  @IsString()
  FABRARY_ALLOW_HOSTS: string =
    '42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com,fabrary.net';

  /**
   * When true, the scraper worker is permitted to run (both via the Railway
   * cron entry point and the admin endpoint). Defaults to false so local dev
   * and CI never accidentally hit Cúpula DT. Must be explicitly set to true
   * in Railway production.
   *
   * Note: class-transformer's enableImplicitConversion converts any non-empty
   * string (including 'false') to boolean true for boolean-typed fields. To
   * prevent this footgun, validateEnv() explicitly converts boolean-string env
   * vars before passing to plainToInstance (see parseBooleanStrings below).
   */
  @IsOptional()
  @IsBoolean()
  STORE_SCRAPER_ENABLED: boolean = false;

  /**
   * Comma-separated hostnames the scraper is allowed to fetch from.
   * Passed verbatim to FetchGuardService as the per-call allowHosts list.
   * Kept separate from FABRARY_ALLOW_HOSTS to prevent cross-contamination
   * if either list grows independently.
   *
   * Required (non-empty) when STORE_SCRAPER_ENABLED=true. An empty list
   * would mean the scraper has no allowed outbound hosts, which would cause
   * every fetch to fail at runtime rather than at boot — validate early instead.
   */
  @ValidateIf((o: EnvDto) => o.STORE_SCRAPER_ENABLED === true)
  @IsString()
  @IsNotEmpty({ message: 'STORE_ALLOW_HOSTS must be non-empty when STORE_SCRAPER_ENABLED=true' })
  @IsOptional()
  STORE_ALLOW_HOSTS: string = 'www.cupuladt.com.br';

  /**
   * Shared-secret header value for the admin endpoint
   * POST /api/admin/stores/:slug/scrape. Required when STORE_SCRAPER_ENABLED
   * is true; optional otherwise (admin endpoint rejects all requests when the
   * scraper is disabled regardless).
   */
  @ValidateIf((o: EnvDto) => o.STORE_SCRAPER_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  ADMIN_API_KEY?: string;
}

/**
 * Converts boolean-string env vars to actual booleans before class-transformer
 * processes them. class-transformer's enableImplicitConversion converts any
 * non-empty string (including 'false') to true for boolean-typed fields —
 * explicit pre-processing is the only reliable workaround.
 *
 * Only applies to fields declared as booleans in EnvDto. Currently: STORE_SCRAPER_ENABLED.
 */
const BOOLEAN_ENV_KEYS: ReadonlyArray<keyof EnvDto> = ['STORE_SCRAPER_ENABLED'] as const;

function parseBooleanStrings(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };
  for (const key of BOOLEAN_ENV_KEYS) {
    const value = result[key];
    if (typeof value === 'string') {
      result[key] = value === 'true' || value === '1';
    }
  }
  return result;
}

export function validateEnv(raw: Record<string, unknown>): EnvDto {
  const dto = plainToInstance(EnvDto, parseBooleanStrings(raw), { enableImplicitConversion: true });
  const errors = validateSync(dto, { skipMissingProperties: false, whitelist: true });
  if (errors.length > 0) {
    const formatted = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${formatted}`);
  }
  return dto;
}
