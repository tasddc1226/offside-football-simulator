// T-11-142 하단 '구단주' 탭 · 구단주 '내 팀' 버튼의 빨간 점(웹·앱 공용). 받은 친구 신청 → 새 업적 → 새 시즌 결산 순으로 알린다.
import { shellText as S } from './i18n/ko/shell.js';

type Dots = { friendReq: number; achNew: number; recapNew?: boolean };

/** 점의 읽기 이름. 점이 없으면 null. '내 팀' 버튼은 결산을 알리지 않으니 recapNew를 넘기지 않는다. */
export function ownerDotLabel(d: Dots): string | null {
  if (d.friendReq) return S.friendReq({ n: d.friendReq });
  if (d.achNew) return S.achNew({ n: d.achNew });
  return d.recapNew ? S.recapNew : null;
}

/** '내 팀'을 누르면 열 곳 — 받은 신청이 있으면 친구 목록, 새 업적이 있으면 업적 탭. */
export const myTeamTarget = (d: Dots): 'friends' | 'achievements' | 'team' =>
  d.friendReq ? 'friends' : d.achNew ? 'achievements' : 'team';
