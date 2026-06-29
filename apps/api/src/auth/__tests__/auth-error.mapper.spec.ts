import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthError, EAuthErrorCode } from '../errors';
import { mapAuthError } from '../auth-error.mapper';

describe('mapAuthError', () => {
  // Done-when: mapper carries code on each mapped exception

  it('maps INVALID_CREDENTIALS to UnauthorizedException with the error code in the response', () => {
    const err = new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password');
    const exception = mapAuthError(err);
    expect(exception).toBeInstanceOf(UnauthorizedException);
    const response = exception.getResponse() as { message: string; code: string };
    expect(response.code).toBe(EAuthErrorCode.InvalidCredentials);
    expect(response.message).toBe('Invalid email or password');
  });

  it('maps EMAIL_NOT_VERIFIED to ForbiddenException with the error code', () => {
    const err = new AuthError(EAuthErrorCode.EmailNotVerified, 'Please verify your email');
    const exception = mapAuthError(err);
    expect(exception).toBeInstanceOf(ForbiddenException);
    const response = exception.getResponse() as { code: string };
    expect(response.code).toBe(EAuthErrorCode.EmailNotVerified);
  });

  it('maps INVALID_TOKEN to BadRequestException with the error code', () => {
    const err = new AuthError(EAuthErrorCode.InvalidToken, 'Invalid token');
    const exception = mapAuthError(err);
    expect(exception).toBeInstanceOf(BadRequestException);
    const response = exception.getResponse() as { code: string };
    expect(response.code).toBe(EAuthErrorCode.InvalidToken);
  });

  it('maps EMAIL_DELIVERY_FAILED to InternalServerErrorException with the error code', () => {
    const err = new AuthError(EAuthErrorCode.EmailDeliveryFailed, 'Could not send email');
    const exception = mapAuthError(err);
    expect(exception).toBeInstanceOf(InternalServerErrorException);
    const response = exception.getResponse() as { code: string };
    expect(response.code).toBe(EAuthErrorCode.EmailDeliveryFailed);
  });

  it('maps USER_NOT_FOUND to NotFoundException with the error code', () => {
    const err = new AuthError(EAuthErrorCode.UserNotFound, 'User not found');
    const exception = mapAuthError(err);
    expect(exception).toBeInstanceOf(NotFoundException);
    const response = exception.getResponse() as { code: string };
    expect(response.code).toBe(EAuthErrorCode.UserNotFound);
  });
});
