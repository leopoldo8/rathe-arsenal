import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  Min,
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

  @IsUrl({ require_tld: false, require_protocol: true })
  AWS_APPSYNC_ENDPOINT!: string;

  @IsString()
  @IsNotEmpty()
  COGNITO_IDENTITY_POOL_ID!: string;

  @IsString()
  @IsNotEmpty()
  COGNITO_REGION!: string;

  @IsString()
  @IsNotEmpty()
  FABRARY_ALLOW_HOSTS!: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvDto {
  const dto = plainToInstance(EnvDto, raw, { enableImplicitConversion: true });
  const errors = validateSync(dto, { skipMissingProperties: false, whitelist: true });
  if (errors.length > 0) {
    const formatted = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${formatted}`);
  }
  return dto;
}
