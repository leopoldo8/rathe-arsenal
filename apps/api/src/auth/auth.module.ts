import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenGeneratorService } from './services/token-generator.service';
import { AuthService } from './auth.service';
import { AuthzService } from './authz.service';
import { AuthController } from './auth.controller';
import { OwnsTrackedDeckGuard } from './guards/owns-tracked-deck.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d',
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, TrackedDeckEntity, CollectionCardEntity]),
  ],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    TokenGeneratorService,
    JwtStrategy,
    JwtAuthGuard,
    AuthService,
    AuthzService,
    OwnsTrackedDeckGuard,
  ],
  exports: [
    PasswordHasherService,
    TokenGeneratorService,
    JwtAuthGuard,
    AuthService,
    AuthzService,
    OwnsTrackedDeckGuard,
    JwtModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}
