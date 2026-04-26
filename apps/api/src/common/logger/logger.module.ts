import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

// Jest sets JEST_WORKER_ID on every worker; use it to detect test runs even
// when NODE_ENV is overridden (e.g., e2e specs that need NODE_ENV=development
// to enable TypeORM synchronize).
const isTest = process.env.JEST_WORKER_ID !== undefined;
const isDev = process.env.NODE_ENV !== 'production' && !isTest;

const pinoHttpOptions = {
  level: isTest ? 'silent' : isDev ? 'debug' : 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true, colorize: true },
        },
      }
    : {}),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.newPassword',
      '*.email',
      '*.verificationToken',
      '*.verificationTokenHash',
      '*.passwordResetToken',
      '*.passwordResetTokenHash',
      '*.jwt',
      '*.collectionPayload',
      'authorization',
      'cookie',
      'password',
      'passwordHash',
      'newPassword',
      'email',
      'verificationToken',
      'verificationTokenHash',
      'passwordResetToken',
      'passwordResetTokenHash',
      'jwt',
      'collectionPayload',
    ],
    censor: '[REDACTED]',
  },
};

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: pinoHttpOptions,
    }),
  ],
})
export class LoggerModule {}
