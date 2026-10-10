// 시즌 일정(웹·앱 공용). 시즌 진행 게이지가 마감을 확정하면 서버가 그 시즌의 마감과 다음 시즌을 일정에 적는다
// (apps/api seasonSchedule.ts). 앱은 마지막으로 받은 일정을 저장해 두었다가 시작 때 입히고, 게이지를 읽을 때마다
// 서버 일정으로 맞춘다 — 시즌을 보는 화면(순위·기록실·결산·만들기의 은퇴 나이)이 앱 업데이트 없이 새 시즌을 따른다.
import {
  applySeasonSchedule,
  seasonSchedule,
  type SeasonScheduleEntry,
} from '@offside/contracts/service-seasons';
import { loadKey, saveKey } from '@offside/game/storage';
import { getSeasonGauge } from './api/client.js';
import { isVisible, watchVisibility } from './api/liveSocket.js';

const KEY = 'ft_season_schedule';
/** 화면으로 돌아왔을 때 다시 묻는 간격. 마감은 확정 뒤 48시간 이상 남아 넉넉하다. */
const RESYNC_MS = 10 * 60_000;
let syncedAt = 0;

/** 서버 일정을 입히고 바뀌었으면 저장한다. */
export function adoptSeasonSchedule(entries: readonly SeasonScheduleEntry[]): void {
  if (applySeasonSchedule(entries)) saveKey(KEY, seasonSchedule());
}

/** 게이지와 시즌 일정을 함께 읽는다(홈 게이지). */
export async function loadSeasonGauge() {
  const r = await getSeasonGauge();
  if (r.ok) {
    adoptSeasonSchedule(r.data.seasons);
    syncedAt = Date.now();
  }
  return r;
}

/**
 * 앱 시작 때 한 번: 저장해 둔 일정을 곧바로 입히고(첫 화면부터 같은 시즌), 서버 일정을 받아 맞춘다. 화면으로 돌아오면
 * RESYNC_MS마다 다시 묻는다. 해제 함수를 돌려준다.
 */
export function startSeasonSchedule(): () => void {
  const saved = loadKey<SeasonScheduleEntry[]>(KEY);
  if (Array.isArray(saved)) applySeasonSchedule(saved);
  const sync = () => void loadSeasonGauge().catch(() => {});
  sync();
  return watchVisibility(() => {
    if (isVisible() && Date.now() - syncedAt >= RESYNC_MS) sync();
  });
}
