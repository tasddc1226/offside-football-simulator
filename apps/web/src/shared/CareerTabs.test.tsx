// UX-014: 헤더 탭 바는 대시보드 콘텐츠(TabsContent)와 다른 React 서브트리라 Radix Tabs.Root로 묶을
// 수 없다(CareerTabs.tsx 상단 주석) — 그래서 role="tab" 선택·화살표 키 이동을 직접 구현했고, 그
// 로직만 여기서 검증한다(URL 동기화는 CareerHeaderBar가 맡는다, 라우터 테스트 범위 밖).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CareerTabs } from './CareerTabs.js';

const ITEMS = [
  { value: 'season', label: '시즌' },
  { value: 'career', label: '커리어' },
  { value: 'player', label: '선수' },
  { value: 'trophies', label: '우승 연혁' },
] as const;

describe('CareerTabs', () => {
  it('active 값에 맞춰 aria-selected·roving tabIndex를 설정한다', () => {
    render(<CareerTabs items={ITEMS} active="player" onChange={() => {}} />);

    const seasonTab = screen.getByRole('tab', { name: '시즌' });
    const playerTab = screen.getByRole('tab', { name: '선수' });
    expect(playerTab).toHaveAttribute('aria-selected', 'true');
    expect(playerTab).toHaveAttribute('tabIndex', '0');
    expect(seasonTab).toHaveAttribute('aria-selected', 'false');
    expect(seasonTab).toHaveAttribute('tabIndex', '-1');
  });

  it('클릭하면 onChange를 그 탭 값으로 부른다', () => {
    const onChange = vi.fn();
    render(<CareerTabs items={ITEMS} active="season" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '커리어' }));
    expect(onChange).toHaveBeenCalledWith('career');
  });

  it('ArrowRight/ArrowLeft는 이웃 탭을 선택하고 포커스를 옮긴다(양 끝은 순환)', () => {
    const onChange = vi.fn();
    render(<CareerTabs items={ITEMS} active="trophies" onChange={onChange} />);

    screen.getByRole('tab', { name: '우승 연혁' }).focus();
    fireEvent.keyDown(screen.getByRole('tab', { name: '우승 연혁' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('season');

    onChange.mockClear();
    screen.getByRole('tab', { name: '우승 연혁' }).focus();
    fireEvent.keyDown(screen.getByRole('tab', { name: '우승 연혁' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('player');
  });
});
