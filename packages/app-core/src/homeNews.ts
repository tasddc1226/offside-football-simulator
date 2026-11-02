// 홈 소식에 올릴 글을 고른다. 릴리즈 노트가 거의 매일 올라와 최신순만으로는 공지가 밀려나므로,
// 가장 최근 공지 1개를 맨 위에 두고 나머지는 게시판을 가리지 않고 최신 글로 채운다.
export const HOME_NEWS_SHOWN = 3;

export function pickHomeNews<T extends { board: string; createdAt: string }>(
  posts: readonly T[],
  shown = HOME_NEWS_SHOWN,
): T[] {
  const latest = posts.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notice = latest.find((p) => p.board === 'notice');
  if (!notice) return latest.slice(0, shown);
  return [notice, ...latest.filter((p) => p !== notice)].slice(0, shown);
}
