/** 리뷰 제출 여부는 OS가 알려 주지 않는다. 기기에 요청한 이력만 저장한다. */
export type ReviewHistory = {
  lastVersion: string;
  lastCareerId: string;
  attempts: number[];
};
const DAY = 86_400_000;
export const REVIEW_GAP_MS = 120 * DAY;
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

export function canRequestReview(h: ReviewHistory, careerId: string, version: string, now: number) {
  return (
    !!careerId &&
    /^\d+\.\d+\.\d+$/.test(version) &&
    h.lastVersion !== version &&
    h.lastCareerId !== careerId &&
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
  function record(careerId: string, version: string) {
    const now = io.now();
    const h = reviewHistory(io.load());
    io.save({
      lastVersion: version,
      lastCareerId: careerId || h.lastCareerId,
      attempts: [...h.attempts.filter((at) => now - at < YEAR).slice(-2), now],
    });
  }
  return {
    /** 화면·계정·앱 상태가 비동기 가용성 확인 중 바뀌면 요청하지 않는다. */
    async afterCareer(careerId: string, safe: () => boolean): Promise<boolean> {
      const version = io.version();
      if (
        busy ||
        !safe() ||
        !canRequestReview(reviewHistory(io.load()), careerId, version, io.now())
      )
        return false;
      busy = true;
      try {
        if (!(await io.available()) || !safe()) return false;
        if (!canRequestReview(reviewHistory(io.load()), careerId, version, io.now())) return false;
        // OS가 창을 생략하거나 실패해도 다시 재촉하지 않는다. 제출/별점은 수집하지 않는다.
        record(careerId, version);
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
