import { describe, expect, it } from 'vitest';
import { clubById } from '@offside/game/clubs';
import { isNationalTeam } from '@offside/game/nation';

describe('T-10-006 seasonPayload', () => {
  // 실제 커리어를 은퇴까지 헤드리스로 돌려(fulltime-sim 랜덤 정책의 축약판) 모든 시즌 페이로드가
  // 서버 계약을 통과하는지 본다. SEASON_PAYLOAD_CAREERS로 표본 수를 늘려 대량 검증할 수 있다.
  it('은퇴까지 모든 시즌 페이로드가 CareerSeasonPayloadSchema를 통과한다', async () => {
    const { CareerSeasonPayloadSchema } = await import('@offside/contracts');
    const g = await import('@offside/game/index');
    const { seasonPayload } = await import('./upload.js');
    const { createRng, setActiveRng, pick, ri } = await import('@offside/game/rng');
    const N = Number(process.env.SEASON_PAYLOAD_CAREERS) || 12;
    let seasons = 0;
    let withComps = 0;
    for (let i = 0; i < N; i++) {
      setActiveRng(createRng(1000 + i));
      const pos = pick(['FW', 'MF', 'DF', 'GK'] as const);
      const s = g.newGame(
        {
          name: 'T',
          number: 9,
          pos,
          foot: '오른발',
          type: pick(g.TYPES[pos]).id,
          trait: pick(g.TRAITS).id,
        },
        1000 + i,
      );
      for (let y = 0; y < 30 && !s.retired; y++) {
        for (let ph = 0; ph <= g.LAST_PHASE; ph++) {
          s.training = s.cond < 45 ? 'rest' : pick(g.ATTR_KEYS);
          const { ev: e } = g.playPhase(s);
          if (e) g.resolveChoice(s, e, ri(0, g.eventById(e)!.choices.length - 1));
        }
        const { rec } = g.endSeason(s);
        const payload = seasonPayload(rec);
        const parsed = CareerSeasonPayloadSchema.safeParse(payload);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
        // T-10-066: 시즌 기록·페이로드는 그 시즌 클럽(상무 포함) id를 함께 남긴다.
        expect(clubById(payload.clubId!)?.name).toBe(rec.club);
        seasons++;
        if (payload.comps?.length) withComps++;
        const m = g.market(s);
        if (!m.options.length || (m.canRetire && s.age >= 35)) g.retire(s);
        else g.acceptOption(s, m.options[0]!);
      }
      if (!s.retired) g.retire(s);
      // 대표팀 우승에는 클럽 id가 없고, 클럽 우승에는 있다.
      for (const t of s.trophies) expect(!!t.clubId).toBe(!isNationalTeam(t.club));
    }
    expect(seasons).toBeGreaterThan(N * 5);
    expect(withComps).toBeGreaterThan(0);
  });
});

describe('T-11-030 잠재력 관찰 업로드', () => {
  it('처음 스카우트 평가는 첫 시즌 기록에만 싣고, 은퇴 때 실제 잠재력을 싣는다', async () => {
    const { PutCareerSeasonBodySchema, PutRetirementBodySchema } =
      await import('@offside/contracts');
    const g = await import('@offside/game/index');
    const { createRng, setActiveRng } = await import('@offside/game/rng');
    const { createUploader } = await import('./upload.js');
    const sent: { season: unknown[]; retire: unknown[] } = { season: [], retire: [] };
    const up = createUploader({
      appVersion: 'test',
      outbox: async () =>
        ({
          enqueueSeason: (_id: string, _y: number, body: unknown) => void sent.season.push(body),
          enqueueRetirement: (_id: string, body: unknown) => void sent.retire.push(body),
        }) as never,
    });
    setActiveRng(createRng(7));
    const s = g.newGame(
      { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      7,
    );
    const first = s.pot;
    for (let y = 0; y < 2; y++) {
      for (let ph = 0; ph <= g.LAST_PHASE; ph++) g.playPhase(s);
      const rec = g.endSeason(s);
      up.uploadSeason(s, rec.rec);
    }
    await new Promise((r) => setTimeout(r, 0));
    const bodies = sent.season.map((b) => PutCareerSeasonBodySchema.parse(b));
    expect(bodies[0]!.career.pot).toBe(first);
    expect(bodies[1]!.career.pot).toBeUndefined();
    const entry = g.retire(s);
    up.uploadRetirement(s.cid, entry);
    await new Promise((r) => setTimeout(r, 0));
    expect(PutRetirementBodySchema.parse(sent.retire[0]).potReal).toBe(Math.round(g.truePot(s)));
  });
});
