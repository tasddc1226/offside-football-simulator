// 내 은퇴 선수(HofEntry)를 고칠 수 있는 원본으로 돌려준다. 화면은 valtio 스냅숏(읽기 전용 복사본)으로 그리지만,
// 이름 공개·대표 칭호 같은 쓰기(웹은 $state 프록시를 그대로 고쳤다)는 원본을 고쳐야 다시 그려진다.
import type { LegendView } from '@offside/app-core/state';
import type { HofEntry } from '@offside/game/types';
import { appState } from '../../store';

/** 선수 상세(Legend)의 v는 appState.legend의 스냅숏 — 같은 선수의 원본이 프록시 안에 있다. 그 밖(은퇴 직후·목록)은 그대로. */
export function liveEntry(h: HofEntry): HofEntry {
  const live = appState.legend?.own;
  return live && live.id === h.id ? live : h;
}

export function ownOf(v: LegendView): HofEntry | null {
  return v.own ? liveEntry(v.own) : null;
}
