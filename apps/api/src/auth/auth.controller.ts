import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ICurrentUser } from './dtos/current-user.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { SignInDto } from './dtos/sign-in.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { AuthService } from './auth.service';
import { AuthError } from './errors';
import { mapAuthError } from './auth-error.mapper';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('sign-up')
  async signUp(@Body() dto: SignUpDto) {
    try {
      return await this.authService.signUp(dto.email, dto.password);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignInDto) {
    try {
      return await this.authService.signIn(dto.email, dto.password);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    try {
      return await this.authService.verifyEmail(dto.token);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      return await this.authService.resetPassword(dto.token, dto.newPassword);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Get('me')
  async getMe(@CurrentUser() user: ICurrentUser) {
    return this.authService.getMe(user);
  }
}
