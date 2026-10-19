import { HttpException, HttpStatus } from '@nestjs/common';

export type TSharingErrorCode = 'SHARE_LINK_UNAVAILABLE' | 'DISPLAY_NAME_REQUIRED';

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
