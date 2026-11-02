import { describe, expect, it } from 'vitest';
import { kakaoAvailable, kakaoFeed } from './kakao.js';

describe('T-11-621 카카오톡 공유', () => {
  it('제목 · 그림 · 링크로 피드 카드를 만든다', () => {
    const feed = kakaoFeed({
      title: 't',
      description: 'd',
      imageUrl: 'https://offside-lab.com/a.png',
      url: 'https://offside-lab.com/?friend=ABCDEFGH',
      button: 'b',
    });
    expect(feed.content.link.webUrl).toBe('https://offside-lab.com/?friend=ABCDEFGH');
    expect(feed.content.link.mobileWebUrl).toBe(feed.content.link.webUrl);
    expect(feed.buttons).toEqual([{ title: 'b', link: feed.content.link }]);
  });

  it('키가 없으면 버튼을 그리지 않는다', () => {
    expect(kakaoAvailable()).toBe(false);
  });
});
