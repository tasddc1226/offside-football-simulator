// T-11-604 구단주 화면 '명예관' 칸의 새 시즌 결산 알림(웹 · 앱 공용). 하단 '구단주' 탭 점은 결산을 열어야 꺼지는데, 명예관은
// 진행 중인 시즌을 먼저 열어 점이 남았다. 안 본 결산이 있으면 명예관 칸에도 점을 띄우고, 누르면 그 시즌 결산부터 연다.
import { recapUnseenSeason } from './api/seasonRecap.js';
import { ownerDotLabel } from './ownerDots.js';

/** 명예관 칸 점의 읽기 이름(안 본 결산이 없으면 null). */
export const hallDotLabel = (recapNew: boolean): string | null =>
  ownerDotLabel({ friendReq: 0, achNew: 0, recapNew });

/** 명예관을 열 때 먼저 고를 시즌: 안 본 결산이 있으면 그 시즌(점을 띄울 때 받은 1분 메모), 아니면 null(명예관 기본값). */
export const hallSeason = async (recapNew: boolean): Promise<number | null> =>
  recapNew ? recapUnseenSeason() : null;
