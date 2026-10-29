import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { SignInCodeEntity } from '../database/entities/sign-in-code.entity';
import { UserSessionEntity } from '../database/entities/user-session.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckTagEntity } from '../database/entities/deck-tag.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenGeneratorService } from './services/token-generator.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SignInCodeService } from './sign-in-code.service';
import { TurnstileService } from './turnstile.service';
import { AuthzService } from './authz.service';
import { AuthController } from './auth.controller';
import { EmailConfirmedGuard } from './guards/email-confirmed.guard';
import { OwnsTrackedDeckGuard } from './guards/owns-tracked-deck.guard';
import { SharingCoreModule } from '../sharing/sharing-core.module';

@Module({
  imports: [
    SharingCoreModule,
    // DeckTagEntity is registered here (not in TagsModule) so that AuthzService
    // can use @InjectRepository(DeckTagEntity) without creating a circular
    // dependency: AuthModule ← TagsModule ← AuthModule.
    TypeOrmModule.forFeature([UserEntity, UserSessionEntity, SignInCodeEntity, TrackedDeckEntity, CollectionCardEntity, DeckTagEntity]),
  ],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    TokenGeneratorService,
    SessionService,
    JwtAuthGuard,
    AuthService,
    SignInCodeService,
    TurnstileService,
    AuthzService,
    OwnsTrackedDeckGuard,
    EmailConfirmedGuard,
  ],
  exports: [
    PasswordHasherService,
    TokenGeneratorService,
    JwtAuthGuard,
    SessionService,
    AuthService,
    AuthzService,
    OwnsTrackedDeckGuard,
    EmailConfirmedGuard,
    TypeOrmModule,
  ],
})
export class AuthModule {}
