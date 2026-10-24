import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

export const INVALID_EMAIL_CODE = 'INVALID_EMAIL';
export const PASSWORD_TOO_SHORT_CODE = 'PASSWORD_TOO_SHORT';

function flattenMessages(errors: readonly ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenMessages(error.children ?? []),
  ]);
}

/** A malformed e-mail or a short password answers with a stable `code` the web localizes; any other failure keeps the plain message list. */
function buildValidationException(errors: ValidationError[]): BadRequestException {
  const message = flattenMessages(errors);
  const brokenEmail = errors.some((error) => error.property === 'email' && error.constraints?.['isEmail'] !== undefined);
  if (brokenEmail) return new BadRequestException({ message, code: INVALID_EMAIL_CODE });
  const shortPassword = errors.some((error) => error.property === 'password' && error.constraints?.['minLength'] !== undefined);
  if (shortPassword) return new BadRequestException({ message, code: PASSWORD_TOO_SHORT_CODE });
  return new BadRequestException(message);
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: buildValidationException,
  });
}
