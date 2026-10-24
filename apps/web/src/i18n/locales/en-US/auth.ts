export const auth = {
  // --- AuthLayout decoration panel (default copy) ---
  decorationDefaultTagline: 'Your decks, your collection.',
  decorationCopy: 'Import your Flesh and Blood decks and see which cards you already own, which swaps cover the gaps, and what it costs to finish.',

  // --- Shared ---
  backToSignIn: 'Back to sign in',

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
