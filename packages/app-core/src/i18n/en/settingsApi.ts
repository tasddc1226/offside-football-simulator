import type { Translation } from '../core';
import type { SettingsApiMsgs } from '../ko/settingsApi';

export const settingsApi: Translation<SettingsApiMsgs> = {
  network: "Couldn't connect to the server.",
  badResponse: "Couldn't read the server's response.",
  failed: "Couldn't process the request.",
  failedStatus: (p) => `Couldn't process the request (${p.status}).`,
  badShape: "The server's response wasn't in the expected format.",
};
