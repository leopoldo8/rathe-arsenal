export const auth = {
  // --- AuthLayout decoration panel (default copy) ---
  decorationDefaultTagline: 'Your decks, your collection.',
  decorationCopy: 'Import your Flesh and Blood decks and see which cards you already own, which swaps cover the gaps, and what it costs to finish.',

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
  signInSubtitle: 'Sign in with your email and password.',
  signInTagline: 'Back to the arsenal.',
  forgotPasswordLink: 'Forgot password?',
  noAccountText: 'No account?',
  createOneLink: 'Create one',
  signingIn: 'Signing in…',
  signInBtn: 'Sign in',

  // --- sign-up ---
  signUpTitle: 'Create your account',
  signUpSubtitle: 'It takes less than a minute.',
  signUpTagline: 'Start with your first deck.',
  alreadyHaveAccount: 'Already have one?',
  signInLink: 'Sign in',
  creating: 'Creating…',
  createAccountBtn: 'Create account',
  termsNote: 'We\'ll send a link to confirm your email.',

  // --- forgot-password ---
  forgotTitle: 'Forgot password',
  forgotSubtitle: "We'll email you a reset link.",
  forgotTagline: 'It happens to everyone.',
  sending: 'Sending…',
  sendResetLinkBtn: 'Send reset link',

  // --- forgot-password sent state ---
  forgotSentTitle: 'Check your email',
  forgotSentTagline: 'Just open the link.',
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
  verifyFailedTagline: 'The link didn\'t work.',
  signUpAgainLink: 'Sign up again',
  verifyNoToken: 'No verification token provided.',
  verifyExpiredFallback: 'This link is invalid or has expired.',
  verifySuccessTitle: 'Email verified',
  verifySuccessSubtitle: 'Your account is ready.',
  verifySuccessTagline: 'All set.',
  continueToOnboarding: 'Continue →',
  verifySuccessMsg: 'Your email is confirmed. Redirecting…',
  verifyingTitle: 'Verifying…',
  verifyingTagline: 'One moment.',
  verifyingMsg: 'Confirming your email…',

  // --- check-your-email ---
  checkEmailTitle: 'Check your email',
  checkEmailSubtitle: "We've sent you a link. Follow it to continue.",
  checkEmailTagline: 'One step left.',
  checkEmailToInbox: 'Sent to your inbox',
  checkEmailCopy:
    "We sent a verification link to your email address. Click it to complete sign-up. The link expires in 24 hours. Check your spam folder if you don't see it.",
  alreadyVerified: 'Already verified? Sign in',
} as const;
