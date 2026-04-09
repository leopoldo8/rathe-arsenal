import { createContext } from 'react';

export interface IAuthUser {
  id: string;
  email: string;
}

export interface IAuthContext {
  user: IAuthUser | null;
  token: string | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ _devVerificationLink?: string | undefined }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  verifyEmail: (token: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<IAuthContext | null>(null);
