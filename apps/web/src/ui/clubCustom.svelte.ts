// ───────── 클럽 커스텀 반응형 상태 (T-10-009, 동기화 T-10-010) ─────────
// 저장·동기화는 app-core/clubCustom이 맡고, 웹은 상태를 Svelte $state로 감싸 넘긴다.
import { createClubCustom, initialClubCustomState } from '@offside/app-core/clubCustom';
import { appState } from './state.svelte.js';
import { save } from './helpers.js';

export const clubCustom = $state(initialClubCustomState());

export const {
  loadClubCustom,
  setClubCustom,
  resetClubCustom,
  exportClubCustom,
  importClubCustom,
  syncClubCustom,
} = createClubCustom(clubCustom, { game: () => appState.G, save });
