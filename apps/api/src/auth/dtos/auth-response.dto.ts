export interface IAuthUser {
  id: string;
  email: string;
}

export interface IAuthResponse {
  jwt: string;
  user: IAuthUser;
}

/**
 * Sign-up and resend-verification endpoints return the same generic response
 * regardless of whether the email already exists / is already verified. This
 * prevents account-existence enumeration (A4/A6). The `_devVerificationLink`
 * field is only populated in development to ease local testing.
 */
export interface IGenericAuthAcceptedResponse {
  message: string;
  _devVerificationLink?: string;
}
