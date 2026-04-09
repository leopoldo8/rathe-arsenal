import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

const isDev = process.env.NODE_ENV !== 'production';

const pinoHttpOptions = {
  level: isDev ? 'debug' : 'info',
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
