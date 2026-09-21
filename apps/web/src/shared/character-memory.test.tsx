import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CareerState, CoachChoiceMemory, CoachMemoryReaction } from '@offside/domain';
import {
  CharacterMemoryPanel,
  characterChoiceTrustDelta,
  hasCharacterChoiceMemory,
} from './character-memory.js';

const memory: CoachChoiceMemory = {
  id: 'choice-first',
  actor: { id: 'coach-old', name: '김정환', teamId: 'club-first' },
  seasonIndex: 1,
  step: 3,
  matchId: 'first-match',
  chapterId: 'CHP-MATCH-100',
  decisionId: 'D1',
  optionId: 'BOLD',
  action: 'SHOT',
  outcomeKind: 'SUCCESS',
  before: { goalsFor: 0, goalsAgainst: 1 },
  after: { goalsFor: 1, goalsAgainst: 1 },
  trustDelta: 0,
};
const reaction: CoachMemoryReaction = {
  id: 'followup-first',
  kind: 'FOLLOW_UP',
  seasonIndex: 2,
  actor: { ...memory.actor },
  memory,
  trustBefore: 100,
  trustAfter: 100,
  trustDelta: 0,
};
function state(overrides: Partial<CareerState> = {}): CareerState {
  return {
    contentPackVersion: '0.12.0',
    season: { index: 2, manager: { id: 'coach-now', name: '현재 다른 감독' } },
    characterMemory: {
      version: 'COACH_MEMORY_V1',
      memories: [memory],
      reactions: [reaction],
      consumed: [],
    },
    ...overrides,
  } as CareerState;
}
afterEach(cleanup);

describe('persisted named coach memory presentation', () => {
  it('uses the captured coach and exact pinned choice, never retrospectively labels it with today’s manager', () => {
    const saved = state();
    const { rerender } = render(
      <CharacterMemoryPanel state={saved} matchId="first-match" decisionId="D1" />,
    );
    expect(screen.getByRole('article', { name: '김정환 감독이 기억한 선택' })).toBeTruthy();
    expect(screen.getByText('내 선택: 직접 슈팅한다')).toBeTruthy();
    expect(screen.getByText('당시 스코어 0:1 → 1:1')).toBeTruthy();
    expect(screen.getByText('선택 당시 감독 신뢰 변화 0')).toBeTruthy();
    expect(characterChoiceTrustDelta(saved, 'first-match', 'D1')).toBe(0);
    expect(characterChoiceTrustDelta(saved, 'missing-match', 'D1')).toBeNull();
    expect(screen.queryByText(/현재 다른 감독/)).toBeNull();
    rerender(
      <CharacterMemoryPanel
        state={{
          ...saved,
          season: {
            ...saved.season!,
            manager: { ...saved.season!.manager!, name: '새로 온 감독' },
          },
        }}
        matchId="first-match"
      />,
    );
    expect(screen.getByRole('article', { name: '김정환 감독이 기억한 선택' })).toBeTruthy();
    expect(screen.queryByText(/새로 온 감독/)).toBeNull();
  });
  it('keeps a reaction’s embedded original choice distinct from later memory and its additional trust change', async () => {
    const later = {
      ...memory,
      id: 'later',
      action: 'PASS' as const,
      optionId: 'LINK',
      trustDelta: -2,
    };
    render(
      <CharacterMemoryPanel
        state={state({
          characterMemory: {
            version: 'COACH_MEMORY_V1',
            memories: [later],
            reactions: [{ ...reaction, trustBefore: 98, trustAfter: 100, trustDelta: 2 }],
            consumed: [],
          },
        })}
        currentSeasonOnly
      />,
    );
    const card = screen.getByRole('article', { name: '2시즌 감독의 후속 반응' });
    expect(within(card).getByText('이번 반응의 감독 신뢰 98 → 100 (+2)')).toBeTruthy();
    expect(within(card).getByText('선택 당시 감독 신뢰 변화 0')).toBeTruthy();
    expect(within(card).getByText('내 선택: 직접 슈팅한다')).toBeTruthy();
    expect(within(card).queryByText(/빈 동료에게 패스/)).toBeNull();
    const summary = within(card).getByText('기억의 바탕이 된 내 선택');
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(summary);
    // JSDOM does not implement native summary Enter activation; real keyboard activation is browser QA.
    await user.click(summary);
    expect(summary.closest('details')?.open).toBe(true);
  });
  it('labels a stored reunion by its season and hides old reactions from the current-season prompt', () => {
    const saved = state({
      characterMemory: {
        version: 'COACH_MEMORY_V1',
        memories: [],
        reactions: [{ ...reaction, kind: 'REUNION', seasonIndex: 4 }],
        consumed: [],
      },
    });
    const { rerender } = render(<CharacterMemoryPanel state={saved} />);
    expect(screen.getByRole('article', { name: '4시즌 감독과 재회' })).toBeTruthy();
    rerender(<CharacterMemoryPanel state={saved} currentSeasonOnly />);
    expect(screen.queryByRole('region', { name: '이번 시즌 인물의 반응' })).toBeNull();
  });
  it('leaves historical packs, absent data and unrelated matches unchanged', () => {
    const { rerender, container } = render(
      <CharacterMemoryPanel state={state({ contentPackVersion: '0.11.0' })} />,
    );
    expect(container.textContent).toBe('');
    expect(
      hasCharacterChoiceMemory(state({ contentPackVersion: '0.11.0' }), 'first-match', 'D1'),
    ).toBe(false);
    const noData = state();
    delete noData.characterMemory;
    rerender(<CharacterMemoryPanel state={noData} />);
    expect(container.textContent).toBe('');
    rerender(<CharacterMemoryPanel state={state()} matchId="another-match" />);
    expect(container.textContent).toBe('');
  });
  it('falls back to saved action when an exact pinned option is unavailable without inventing a choice', () => {
    render(
      <CharacterMemoryPanel
        state={state({
          characterMemory: {
            version: 'COACH_MEMORY_V1',
            memories: [{ ...memory, chapterId: 'missing-source-chapter', optionId: 'unknown' }],
            reactions: [],
            consumed: [],
          },
        })}
      />,
    );
    expect(screen.getByText('내 선택: 슈팅')).toBeTruthy();
    expect(screen.queryByText('내 선택: 직접 슈팅한다')).toBeNull();
  });
});
