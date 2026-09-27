// ───────── 새 소식 알림 (T-10-058) ─────────
// 관리자가 공지사항·릴리즈 노트에 새 글을 올리면, 앱을 열어 둔 사람에게 화면 위 알림을 띄운다.
// 두 게시판의 첫 페이지(홈 소식 칸과 같은 요청 — 엣지 캐시 + 60초 메모)를 앱을 열 때와 탭으로 돌아올 때
// 이따금 보고, 이 기기에서 마지막으로 본 글보다 새 글이 있으면 알린다. 처음 온 기기는 지금까지의 글을
// 본 것으로 치고 알리지 않는다. 브라우저 푸시가 아니라서 앱을 닫아 둔 동안에는 오지 않는다.
import { fetchPosts, type PostSummary } from '../api/boards.js';
import { BOARD_KEYS } from '@offside/contracts/board-limits';

/** post: 알릴 글(새 글 중 가장 최근), count: 새 글 수. */
export const newsState = $state<{ post: PostSummary | null; count: number }>({
  post: null,
  count: 0,
});

const SEEN_KEY = 'ft_news_seen';
const MIN_GAP_MS = 5 * 60_000;
let lastCheck = 0;
/** 지금 알림에 걸린 새 글 중 가장 늦은 글의 시각 — 알림을 닫거나 열면 여기까지 본 것으로 친다. */
let newest = '';

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function writeSeen(iso: string) {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {
    /* 저장소를 못 쓰면 이번 방문 동안만 기억한다 */
  }
}

/** iso(글 작성 시각)까지 본 것으로 기록한다. 알림에 걸린 글을 다 봤으면 알림도 닫는다. */
export function markNewsSeen(iso: string) {
  const seen = readSeen();
  if (!seen || iso > seen) writeSeen(iso);
  if (newsState.post && newest <= iso) newsState.post = null;
}
/** 알림을 닫거나 '보기'를 누르면 걸린 새 글을 모두 본 것으로 친다. */
export const dismissNews = () => markNewsSeen(newest);

async function checkNews(): Promise<void> {
  if (Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  const results = await Promise.all(BOARD_KEYS.map((b) => fetchPosts(b)));
  if (results.some((r) => !r.ok)) return; // 한쪽이라도 못 읽으면 다음에 다시 본다.
  const posts = results.flatMap((r) => (r.ok ? r.data.posts : []));
  const seen = readSeen();
  if (seen === null) {
    // 처음 온 기기: 지금까지 올라온 글은 알리지 않는다(글이 하나도 없으면 첫 글부터 알린다).
    writeSeen(
      posts.reduce((max, p) => (p.createdAt > max ? p.createdAt : max), new Date(0).toISOString()),
    );
    return;
  }
  const fresh = posts
    .filter((p) => p.createdAt > seen)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!fresh.length) return;
  newest = fresh[0]!.createdAt;
  newsState.post = fresh[0]!;
  newsState.count = fresh.length;
}

const checkIfVisible = () => {
  if (document.visibilityState === 'visible') void checkNews();
};

export function watchNews(): void {
  void checkNews();
  document.addEventListener('visibilitychange', checkIfVisible);
  setInterval(checkIfVisible, MIN_GAP_MS);
}
