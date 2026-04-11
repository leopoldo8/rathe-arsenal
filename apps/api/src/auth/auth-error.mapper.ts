import {
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthError, EAuthErrorCode } from './errors';

const STATUS_MAP: Record<EAuthErrorCode, new (msg: string) => HttpException> = {
  [EAuthErrorCode.InvalidCredentials]: UnauthorizedException,
  [EAuthErrorCode.EmailNotVerified]: ForbiddenException,
  [EAuthErrorCode.InvalidToken]: BadRequestException,
  [EAuthErrorCode.TokenExpired]: BadRequestException,
  [EAuthErrorCode.EmailDeliveryFailed]: InternalServerErrorException,
};

export function mapAuthError(err: AuthError): HttpException {
  const ExceptionClass = STATUS_MAP[err.code] ?? InternalServerErrorException;
  return new ExceptionClass(err.message);
}
