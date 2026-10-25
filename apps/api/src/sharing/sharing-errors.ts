import { HttpException, HttpStatus } from '@nestjs/common';

export type TSharingErrorCode = 'SHARE_LINK_UNAVAILABLE' | 'DISPLAY_NAME_REQUIRED' | 'COPY_VARIANT_REQUIRED';

export function shareLinkUnavailable(): HttpException {
  return new HttpException(
    { code: 'SHARE_LINK_UNAVAILABLE', message: 'This link is no longer available' },
    HttpStatus.NOT_FOUND,
  );
}

export function displayNameRequired(): HttpException {
  return new HttpException(
    { code: 'DISPLAY_NAME_REQUIRED', message: 'Choose a display name before sharing' },
    HttpStatus.CONFLICT,
  );
}

export function copyVariantRequired(): HttpException {
  return new HttpException(
    { code: 'COPY_VARIANT_REQUIRED', message: 'This deck has substitutions: choose the list before it is saved' },
    HttpStatus.BAD_REQUEST,
  );
}
