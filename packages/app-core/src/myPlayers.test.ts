import { describe, expect, it } from 'vitest';
import { CARD_VALUE_FLOOR, cardValue } from '@offside/contracts/market-value';
import { localCardValue, myPlayerNation } from './myPlayers.js';

describe('내 은퇴 선수 국적', () => {
  it.each(['BR', 'GB-ENG', 'KR'])('새 로컬·다른 기기 계정·병합 기록의 %s를 보존한다', (nation) => {
    expect(myPlayerNation({ nation })).toBe(nation);
    expect(myPlayerNation(undefined, { nation })).toBe(nation);
    expect(myPlayerNation({}, { nation })).toBe(nation);
    expect(myPlayerNation({ nation }, {})).toBe(nation);
    expect(myPlayerNation({ nation }, { nation: null })).toBe(nation);
  });

  it('기록된 로컬 국적을 보존하고 국적 없는 옛 기록에는 나라를 추측하지 않는다', () => {
    expect(myPlayerNation({ nation: 'BR' }, { nation: 'KR' })).toBe('BR');
    expect(myPlayerNation({}, {})).toBeUndefined();
    expect(myPlayerNation({ nation: null }, { nation: null })).toBeUndefined();
    expect(myPlayerNation({ nation: 'invalid' }, { nation: 'GB-ENG' })).toBe('GB-ENG');
    expect(myPlayerNation({ nation: 'invalid' })).toBeUndefined();
    expect(myPlayerNation()).toBeUndefined();
  });
});

describe('이 기기 은퇴 기록의 카드 기준가(T-11-109)', () => {
  it('최고 OVR 시즌 몸값, 시즌 기록이 없으면 하한', () => {
    const career = [
      { league: 'K리그1', ovr: 70, age: 24 },
      { league: 'K리그1', ovr: 75, age: 27 },
    ];
    expect(localCardValue({ peak: 75, detail: { career } })).toBe(cardValue(career, 75));
    expect(localCardValue({ peak: 75 })).toBe(CARD_VALUE_FLOOR);
  });
});

// Hub totals must remain independent of the season selected on the dedicated page.
vi.mock('./api/client.js', () => ({ getMyCareers: vi.fn(), getRetiredNumbersIn: vi.fn() }));
vi.mock('@offside/game/hof-store', () => ({ loadHOF: vi.fn() }));
vi.mock('./outbox.js', () => ({ pendingRetirementIds: () => new Set(['pending']) }));
import { vi, afterEach } from 'vitest';
import { getMyCareers } from './api/client.js';
import { loadHOF } from '@offside/game/hof-store';
import { loadMyPlayerSummary } from './myPlayers.js';
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe('dedicated player hub summary', () => {
  it('counts current-season account records and unsynced retirements, preserving local scores and numbers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    vi.mocked(loadHOF).mockReturnValue([
      { id: 'a', season: 1, score: 90, peak: 80, rn: { kind: 'granted', number: 9 } },
      { id: 'pending', score: 20, peak: 80 },
      { id: 'unlinked', season: 1, score: 999, peak: 80 },
    ] as never);
    vi.mocked(getMyCareers).mockResolvedValue({
      ok: true,
      data: {
        linked: true,
        entries: [
          { id: 'a', season: 1, legendScore: 80 },
          { id: 'old', season: 0, legendScore: 999 },
        ],
      },
    } as never);
    expect(await loadMyPlayerSummary(true)).toMatchObject({ players: 2, score: 110, retired: 1 });
  });
  it('uses local current-season records for guests without an account-list request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    vi.mocked(loadHOF).mockReturnValue([
      { season: 1, score: 30, peak: 80 },
      { season: 0, score: 999, peak: 80 },
    ] as never);
    expect(await loadMyPlayerSummary(false)).toMatchObject({ players: 1, score: 30 });
    expect(getMyCareers).not.toHaveBeenCalled();
  });
});
