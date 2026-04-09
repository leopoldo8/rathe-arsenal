import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
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
      },
    }),
  ],
})
export class LoggerModule {}
