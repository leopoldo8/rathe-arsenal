import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthError, EAuthErrorCode } from './errors';

class TooManyRequestsException extends HttpException {
  constructor(response: string | object) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}

const STATUS_MAP: Record<EAuthErrorCode, new (response: string | object) => HttpException> = {
  [EAuthErrorCode.InvalidCredentials]: UnauthorizedException,
  [EAuthErrorCode.EmailNotVerified]: ForbiddenException,
  [EAuthErrorCode.EmailNotConfirmed]: ForbiddenException,
  [EAuthErrorCode.EmailAlreadyConfirmed]: BadRequestException,
  [EAuthErrorCode.InvalidToken]: BadRequestException,
  [EAuthErrorCode.TokenExpired]: GoneException,
  [EAuthErrorCode.EmailDeliveryFailed]: InternalServerErrorException,
  [EAuthErrorCode.UserNotFound]: NotFoundException,
  [EAuthErrorCode.EmailTaken]: ConflictException,
  [EAuthErrorCode.InvalidCode]: UnauthorizedException,
  [EAuthErrorCode.CaptchaFailed]: BadRequestException,
  [EAuthErrorCode.TooManyCodes]: TooManyRequestsException,
};

export function mapAuthError(err: AuthError): HttpException {
  const ExceptionClass = STATUS_MAP[err.code] ?? InternalServerErrorException;
  return new ExceptionClass({ message: err.message, code: err.code });
}
