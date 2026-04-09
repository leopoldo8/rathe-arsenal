import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { validateEnv } from './env.dto';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: [
        resolve('.env'),
        resolve('..', '..', '.env'),
      ],
    }),
  ],
})
export class ConfigModule {}
