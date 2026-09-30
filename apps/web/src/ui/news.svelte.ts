// ───────── 새 소식 알림 (T-10-058) ─────────
// 확인·본 글 기록은 app-core/news가 맡는다. 웹은 상태를 $state로 감싸고, 탭으로 돌아올 때·주기적으로 확인한다.
import { createNews, initialNewsState, NEWS_GAP_MS } from '@offside/app-core/news';

export { touchedAt } from '@offside/app-core/news';

export const newsState = $state(initialNewsState());

export const { markNewsSeen, dismissNews, checkNews } = createNews(newsState);

const checkIfVisible = () => {
  if (document.visibilityState === 'visible') void checkNews();
};

export function watchNews(): void {
  void checkNews();
  document.addEventListener('visibilitychange', checkIfVisible);
  setInterval(checkIfVisible, NEWS_GAP_MS);
}
