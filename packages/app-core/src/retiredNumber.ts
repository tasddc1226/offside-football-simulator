// ───────── 영구결번 심사 결과 (웹·앱 공용, T-10-076 · 공용 T-11-005) ─────────
// 은퇴 업로드 응답의 심사 결과를 이 기기의 명예의 전당 기록(ft_hof)에 남기고, 은퇴 화면이 바로 다시 그리도록
// 반응형 맵(rnResults)에도 넣는다. 서버 어딘가에서 확정된 영구결번은 라이브 소켓으로 받아 rnAlert에 둔다.
// 반응성은 클라이언트가 붙인다 — 넘겨받은 객체를 그대로 고친다.
import type {
  LiveRetiredNumber,
  RetiredNumberResult,
  RetiredNumbersResponse,
} from '@offside/contracts';
import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { loadHOF, saveKey } from '@offside/game/season';
import { onLive } from './api/liveSocket.js';

export type RnResults = Record<string, RetiredNumberResult | null>;
export type RnAlert = { item: LiveRetiredNumber | null };

export function createRetiredNumbers(
  rnResults: RnResults,
  rnAlert: RnAlert,
  onTitle?: (careerId: string, title: string | null) => void,
) {
  /** 심사 결과를 반응형 맵과 이 기기의 은퇴 기록에 남긴다. serviceSeason(T-11-029)이 오면 기록의 시즌도 남긴다. */
  function recordRn(
    careerId: string,
    result: RetiredNumberResult | null,
    serviceSeason?: number | null,
    title?: string | null,
  ) {
    rnResults[careerId] = result;
    if (title !== undefined) onTitle?.(careerId, title);
    const hof = loadHOF();
    const h = hof.find((x) => x.id === careerId);
    if (!h) return;
    h.rn = result;
    if (title !== undefined) h.title = title ?? undefined;
    const granted = result?.kind === 'taken' && result.wallOfHonor;
    if (h.detail) {
      h.detail.titles = (h.detail.titles ?? []).filter((t) => t.id !== WALL_OF_HONOR_TITLE_ID);
      if (granted) h.detail.titles.push({ id: WALL_OF_HONOR_TITLE_ID, year: 0 });
    }
    if (!granted && h.title === WALL_OF_HONOR_TITLE_ID) delete h.title;
    // 휴식기에 올라온 선수(null)는 결번처럼 프리시즌으로 센다.
    if (serviceSeason !== undefined) h.season = serviceSeason ?? 0;
    saveKey('ft_hof', hof);
  }

  /** 서버 결번 목록의 내 선수 결번을 이 기기 기록에 채운다(배포 전 은퇴를 소급해 받은 결번은 기기에 없다). */
  function fillGranted(items: RetiredNumbersResponse['items']) {
    const hof = loadHOF();
    const mine = new Map(hof.flatMap((h) => (h.id && h.rn?.kind !== 'granted' ? [[h.id, h]] : [])));
    let changed = false;
    for (const { careerId, clubId, club, number, seq } of items) {
      const h = mine.get(careerId);
      if (!h) continue;
      h.rn = rnResults[careerId] = { kind: 'granted', clubId, club, number, seq };
      changed = true;
    }
    if (changed) saveKey('ft_hof', hof);
  }

  /** 이 선수의 결과 — 이번 접속에서 받은 값이 먼저, 없으면 저장된 값. */
  const rnOf = (careerId: string | undefined, saved: RetiredNumberResult | null | undefined) =>
    careerId && careerId in rnResults ? rnResults[careerId] : saved;

  /** 홈 라이브 소켓으로 영구결번 소식을 듣는다(어느 화면에서나). 내 선수는 은퇴 화면 세리머니로 이미 봤다. */
  function watchRetiredNumberAlerts() {
    return onLive((p) => {
      if (p.type !== 'retiredNumber') return;
      if (loadHOF().some((h) => h.id === p.item.careerId)) return;
      rnAlert.item = p.item;
    });
  }

  return { recordRn, fillGranted, rnOf, watchRetiredNumberAlerts };
}
