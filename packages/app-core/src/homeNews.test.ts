import { describe, expect, it } from 'vitest';
import { pickHomeNews } from './homeNews';

const post = (id: string, board: string, day: number) => ({
  id,
  board,
  createdAt: `2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`,
});
const ids = (posts: { id: string }[]) => posts.map((p) => p.id);

describe('홈 소식 글 고르기', () => {
  it('릴리즈 노트가 더 최근이어도 가장 최근 공지 1개를 맨 위에 둔다', () => {
    const posts = [
      post('n1', 'notice', 1),
      post('n2', 'notice', 2),
      post('r3', 'release', 3),
      post('r4', 'release', 4),
      post('r5', 'release', 5),
    ];
    expect(ids(pickHomeNews(posts))).toEqual(['n2', 'r5', 'r4']);
  });
  it('공지가 더 있어도 나머지 칸은 최신순으로만 채운다', () => {
    const posts = [post('r1', 'release', 1), post('n2', 'notice', 2), post('n3', 'notice', 3)];
    expect(ids(pickHomeNews(posts))).toEqual(['n3', 'n2', 'r1']);
  });
  it('공지가 없으면 최신 글만, 글이 적으면 있는 만큼만 보여 준다', () => {
    expect(ids(pickHomeNews([post('r1', 'release', 1), post('r2', 'release', 2)]))).toEqual([
      'r2',
      'r1',
    ]);
    expect(pickHomeNews([])).toEqual([]);
  });
});
