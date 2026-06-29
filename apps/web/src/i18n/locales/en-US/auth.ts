export const auth = {
  // --- AuthLayout decoration panel (default copy) ---
  decorationDefaultTagline: 'Your arsenal, forged.',
  decorationCopy:
    'Track your Flesh and Blood decks. See which cards you own, which have substitutes, and what it would cost to finish the build.',
  decorationQuote: 'A warrior prepares the blade before the battle, not during it.',
  decorationQuoteCite: '— Rathe proverb',

  // --- Shared ---
  emailLabel: 'Email',
  emailPlaceholder: 'hero@rathe.gg',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Password',
  newPasswordLabel: 'New password',
  passwordMinHint: 'At least 10 characters.',
  passwordMinPlaceholder: 'At least 10 characters',
  backToSignIn: 'Back to sign in',
  allFieldsRequired: 'All fields are required',

  // --- sign-in ---
  signInTitle: 'Sign in',
  signInSubtitle: 'Welcome back, Hero.',
  signInTagline: 'Welcome back to the armory.',
  forgotPasswordLink: 'Forgot password?',
  noAccountText: 'No account?',
  createOneLink: 'Create one',
  signingIn: 'Signing in…',
  signInBtn: 'Sign in',

  // --- sign-up ---
  signUpTitle: 'Create your account',
  signUpSubtitle: 'Start tracking in under a minute.',
  signUpTagline: 'Join the armory.',
  alreadyHaveAccount: 'Already have one?',
  signInLink: 'Sign in',
  creating: 'Creating…',
  createAccountBtn: 'Create account',
  termsNote:
    "By creating an account you accept the terms. We'll send a verification link to confirm your email.",

  // --- forgot-password ---
  forgotTitle: 'Forgot password',
  forgotSubtitle: "We'll email you a reset link.",
  forgotTagline: "Lost the key? We'll forge another.",
  sending: 'Sending…',
  sendResetLinkBtn: 'Send reset link',

  // --- forgot-password sent state ---
  forgotSentTitle: 'Check your email',
  forgotSentTagline: 'The raven has flown.',
  forgotSentToInbox: 'Sent to your inbox',
  forgotSentCopy:
    "If an account exists for that email, we sent a password reset link. Check your spam folder if you don't see it in 2 minutes.",

  // --- reset-password ---
  resetTitle: 'Set a new password',
  resetSubtitle: 'Choose carefully — your arsenal awaits.',
  resetTagline: 'A new key, a new campaign.',
  resetMissingToken: 'Missing reset token',
  resetPasswordTooShort: 'Password must be at least 10 characters',
  resetting: 'Resetting…',
  updatePasswordBtn: 'Update password',

  // --- verify-email ---
  verifyFailedTitle: 'Verification failed',
  verifyFailedTagline: 'The seal could not be set.',
  signUpAgainLink: 'Sign up again',
  verifyNoToken: 'No verification token provided.',
  verifyExpiredFallback: 'This link is invalid or has expired.',
  verifySuccessTitle: 'Email verified',
  verifySuccessSubtitle: 'Welcome to the arsenal.',
  verifySuccessTagline: 'The seal is set.',
  continueToOnboarding: 'Continue to onboarding →',
  verifySuccessMsg: 'Your email is confirmed. Redirecting…',
  verifyingTitle: 'Verifying…',
  verifyingTagline: 'The seal is being set.',
  verifyingMsg: 'Confirming seal…',

  // --- check-your-email ---
  checkEmailTitle: 'Check your email',
  checkEmailSubtitle: "We've sent you a link. Follow it to continue.",
  checkEmailTagline: 'The raven has flown.',
  checkEmailToInbox: 'Sent to your inbox',
  checkEmailCopy:
    "We sent a verification link to your email address. Click it to complete sign-up. The link expires in 24 hours. Check your spam folder if you don't see it.",
  alreadyVerified: 'Already verified? Sign in',
} as const;
