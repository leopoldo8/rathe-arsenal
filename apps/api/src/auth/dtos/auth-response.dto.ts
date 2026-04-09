export interface IAuthUser {
  id: string;
  email: string;
}

export interface IAuthResponse {
  jwt: string;
  user: IAuthUser;
}

export interface ISignUpResponse {
  userId: string;
  email: string;
  _devVerificationLink?: string;
}
