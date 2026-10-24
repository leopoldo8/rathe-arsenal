import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

export const INVALID_EMAIL_CODE = 'INVALID_EMAIL';

function flattenMessages(errors: readonly ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenMessages(error.children ?? []),
  ]);
}

/**
 * A malformed e-mail answers with a stable `code` the web localizes ("E-mail inválido"); every
 * other validation failure keeps the plain message list until the auth forms map their own codes.
 */
function buildValidationException(errors: ValidationError[]): BadRequestException {
  const message = flattenMessages(errors);
  const brokenEmail = errors.some((error) => error.property === 'email' && error.constraints?.['isEmail'] !== undefined);
  if (brokenEmail) return new BadRequestException({ message, code: INVALID_EMAIL_CODE });
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
