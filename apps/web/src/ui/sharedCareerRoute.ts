import { appState } from './state.svelte.js';
import { SHARE_PATH } from '../share-path.js';

/** Synchronous URL routing must happen before first render; detail code loads on demand. */
export function routeSharedCareer() {
  const match = SHARE_PATH.exec(window.location.pathname);
  if (!match) return;
  appState.sharedCareer = match[1]!.toLowerCase();
  appState.screen = 'shared';
}
