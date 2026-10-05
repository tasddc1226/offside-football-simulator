import type { Translation } from '../core';
import type { ShellLoginMsgs } from '../ko/shellLogin';

export const shellLogin: Translation<ShellLoginMsgs> = {
  failSession: "Sign-in isn't ready yet. Please tap again.",
  failRateLimited: 'Too many sign-in attempts. Please try again in a moment.',
  failUnavailable: "Google sign-in isn't available right now. Please try again in a moment.",
  failCancelled: 'Sign-in cancelled.',
  offline: "Couldn't reach the server. Please try signing in again shortly.",
  failGeneric: (p) => `Google sign-in failed${p.reason ? ` (${p.reason})` : ''}.`,
  providerGoogle: 'Google',
  linked: (p) => `${p.via} account linked.`,
  switched: (p) => `Switched to a different ${p.via} account.`,
};
