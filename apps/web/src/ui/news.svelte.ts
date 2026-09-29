// ───────── 새 소식 알림 (T-10-058) ─────────
// 관리자가 공지사항·릴리즈 노트에 새 글을 올리면, 앱을 열어 둔 사람에게 화면 위 알림을 띄운다.
// 두 게시판의 첫 페이지(홈 소식 칸과 같은 요청 — 엣지 캐시 + 60초 메모)를 앱을 열 때와 탭으로 돌아올 때
// 이따금 보고, 이 기기에서 마지막으로 본 글보다 새 글이 있으면 알린다. 처음 온 기기는 지금까지의 글을
// 본 것으로 치고 알리지 않는다. 브라우저 푸시가 아니라서 앱을 닫아 둔 동안에는 오지 않는다.
// T-10-098: 이미 본 글이 고쳐져도 알린다 — '본 시각'을 글 작성 시각 대신 마지막으로 바뀐 시각(touchedAt)과 견준다.
import { fetchPosts, type PostSummary } from '../api/boards.js';
import { BOARD_KEYS } from '@offside/contracts/board-limits';
import { loadKey, saveKey } from '../game/season.js';

/** post: 알릴 글(새로 올라오거나 고쳐진 글 중 가장 최근), count: 그런 글 수, edited: post가 본 뒤 고쳐진 글이다. */
export const newsState = $state<{ post: PostSummary | null; count: number; edited: boolean }>({
  post: null,
  count: 0,
  edited: false,
});

/** 글이 마지막으로 바뀐 시각 — 고친 적 없으면 작성 시각. */
export const touchedAt = (p: Pick<PostSummary, 'createdAt' | 'updatedAt'>) =>
  p.updatedAt > p.createdAt ? p.updatedAt : p.createdAt;

const SEEN_KEY = 'ft_news_seen';
// 새 버전 확인(update.svelte.ts)과 같은 간격.
const MIN_GAP_MS = 10 * 60_000;
let lastCheck = 0;

/** iso(글이 마지막으로 바뀐 시각)까지 본 것으로 기록한다. 알림에 걸린 글을 다 봤으면 알림도 닫는다. */
export function markNewsSeen(iso: string) {
  const seen = loadKey<string>(SEEN_KEY);
  if (!seen || iso > seen) saveKey(SEEN_KEY, iso);
  if (newsState.post && touchedAt(newsState.post) <= iso) newsState.post = null;
}
/** 알림을 닫거나 '보기'를 누르면 걸린 글(알린 글이 그중 가장 늦다)을 모두 본 것으로 친다. */
export const dismissNews = () => newsState.post && markNewsSeen(touchedAt(newsState.post));

async function checkNews(): Promise<void> {
  if (Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  const results = await Promise.all(BOARD_KEYS.map((b) => fetchPosts(b)));
  if (results.some((r) => !r.ok)) return; // 한쪽이라도 못 읽으면 다음에 다시 본다.
  const posts = results.flatMap((r) => (r.ok ? r.data.posts : []));
  const seen = loadKey<string>(SEEN_KEY);
  if (seen === null) {
    // 처음 온 기기: 지금까지 올라온 글은 알리지 않는다(글이 하나도 없으면 첫 글부터 알린다).
    saveKey(
      SEEN_KEY,
      posts.reduce(
        (max, p) => (touchedAt(p) > max ? touchedAt(p) : max),
        new Date(0).toISOString(),
      ),
    );
    return;
  }
  const fresh = posts
    .filter((p) => touchedAt(p) > seen)
    .sort((a, b) => (touchedAt(a) < touchedAt(b) ? 1 : -1));
  if (!fresh.length) return;
  newsState.post = fresh[0]!;
  newsState.count = fresh.length;
  newsState.edited = fresh[0]!.createdAt <= seen;
}

const checkIfVisible = () => {
  if (document.visibilityState === 'visible') void checkNews();
};

export function watchNews(): void {
  void checkNews();
  document.addEventListener('visibilitychange', checkIfVisible);
  setInterval(checkIfVisible, MIN_GAP_MS);
}
