import { legendBand } from '@offside/game/legend-bands';

/** 리뷰 제출 여부는 OS가 알려 주지 않는다. 기기에 요청한 이력만 저장한다. lastCareerId는 마지막으로 요청한 순간의 키다. */
export type ReviewHistory = {
  lastVersion: string;
  lastCareerId: string;
  attempts: number[];
};
const DAY = 86_400_000;
/** T-11-586 같은 주에 또 묻지 않을 만큼만 둔다. 실제로 보이는 횟수는 OS가 막는다(iOS 1년 3번). */
export const REVIEW_GAP_MS = 45 * DAY;
const YEAR = 365 * DAY;

export function reviewHistory(value: unknown): ReviewHistory {
  const v = value && typeof value === 'object' ? (value as Partial<ReviewHistory>) : {};
  return {
    lastVersion: typeof v.lastVersion === 'string' ? v.lastVersion : '',
    lastCareerId: typeof v.lastCareerId === 'string' ? v.lastCareerId : '',
    attempts: Array.isArray(v.attempts)
      ? v.attempts.filter(
          (at): at is number => typeof at === 'number' && Number.isFinite(at) && at >= 0,
        )
      : [],
  };
}

/**
 * T-11-586 리뷰는 기분 좋은 커리어 끝에서만 묻는다. 클럽 레전드 이상이거나 발롱도르를 한 번이라도 받은 커리어.
 * 부상으로 일찍 끝났거나 평범하게 끝난 은퇴에서 묻지 않는다.
 */
export function reviewWorthyCareer(
  score: number,
  dpos: string | null | undefined,
  ballonWins: number,
) {
  return ballonWins > 0 || ['lg_goat', 'lg_world', 'lg_club'].includes(legendBand(score, dpos).id);
}

/** 순간 키(커리어 id · 받은 선물 id)마다 한 번, 요청 사이 45일, 1년 3번. OTA로 버전이 오래 같아도 다시 묻는다. */
export function canRequestReview(h: ReviewHistory, key: string, version: string, now: number) {
  return (
    !!key &&
    /^\d+\.\d+\.\d+$/.test(version) &&
    h.lastCareerId !== key &&
    h.attempts.every((at) => now - at >= REVIEW_GAP_MS) &&
    h.attempts.filter((at) => now - at < YEAR).length < 3
  );
}

export function createReviewPrompt(io: {
  load: () => unknown;
  save: (history: ReviewHistory) => void;
  version: () => string;
  now: () => number;
  available: () => Promise<boolean>;
  request: () => Promise<void>;
}) {
  let busy = false;
  function record(key: string, version: string) {
    const now = io.now();
    const h = reviewHistory(io.load());
    io.save({
      lastVersion: version,
      lastCareerId: key || h.lastCareerId,
      attempts: [...h.attempts.filter((at) => now - at < YEAR).slice(-2), now],
    });
  }
  return {
    /** 좋은 순간(좋은 커리어 은퇴 · 시즌 보상 받기) 뒤. 화면·계정·앱 상태가 비동기 가용성 확인 중 바뀌면 요청하지 않는다. */
    async afterHighlight(key: string, safe: () => boolean): Promise<boolean> {
      const version = io.version();
      if (busy || !safe() || !canRequestReview(reviewHistory(io.load()), key, version, io.now()))
        return false;
      busy = true;
      try {
        if (!(await io.available()) || !safe()) return false;
        if (!canRequestReview(reviewHistory(io.load()), key, version, io.now())) return false;
        // OS가 창을 생략하거나 실패해도 다시 재촉하지 않는다. 제출/별점은 수집하지 않는다.
        record(key, version);
        await io.request();
        return true;
      } catch {
        return false;
      } finally {
        busy = false;
      }
    },
    /** 직접 스토어를 연 뒤에도 당분간 자동 요청을 쉬게 한다. */
    manualOpened: () => record('', io.version()),
  };
}
