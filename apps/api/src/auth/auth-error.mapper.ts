import {
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthError, EAuthErrorCode } from './errors';

const STATUS_MAP: Record<EAuthErrorCode, new (response: string | object) => HttpException> = {
  [EAuthErrorCode.InvalidCredentials]: UnauthorizedException,
  [EAuthErrorCode.EmailNotVerified]: ForbiddenException,
  [EAuthErrorCode.InvalidToken]: BadRequestException,
  [EAuthErrorCode.TokenExpired]: BadRequestException,
  [EAuthErrorCode.EmailDeliveryFailed]: InternalServerErrorException,
  [EAuthErrorCode.UserNotFound]: NotFoundException,
};

export function mapAuthError(err: AuthError): HttpException {
  const ExceptionClass = STATUS_MAP[err.code] ?? InternalServerErrorException;
  return new ExceptionClass({ message: err.message, code: err.code });
}
