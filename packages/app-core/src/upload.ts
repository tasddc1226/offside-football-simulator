// ───────── 플레이 기록 업로드 (웹·앱 공용, T-11-002) ─────────
// 시즌 종료·은퇴 때 서버로 보낼 본문을 만들어 업로드 큐(outbox.ts)에 넣는다. 큐 모듈은 클라이언트가 넘긴다
// (웹은 동적 import로 메인 청크와 분리한다).
import type {
  CareerSeasonPayload,
  PlaySignals,
  PutCareerSeasonBody,
  PutRetirementBody,
} from '@offside/contracts';
import { toPublicName } from '@offside/contracts/content-filter';
import type { CareerRecord, GameState, HofEntry } from '@offside/game/types';
import { publicNameOf } from './namePublic.js';
import type * as Outbox from './outbox.js';

/** 시즌 한 줄(`CareerRecord`) → 업로드 페이로드. T-10-006부터 시즌 상세(무실점·리그 기록·A매치·
 * 대회별·커리어 하이)도 함께 보낸다. 대회 기록은 진행 상태 필드(alive/pts/played 등)를 뺀다. */
export function seasonPayload(rec: CareerRecord): CareerSeasonPayload {
  return {
    age: rec.age,
    club: rec.club,
    clubId: rec.clubId,
    league: rec.league,
    apps: rec.apps,
    goals: rec.goals,
    assists: rec.assists,
    rating: rec.rating,
    rank: rec.rank,
    ovr: rec.ovr,
    honors: rec.honors,
    mil: !!rec.mil,
    cs: rec.cs,
    lgApps: rec.lgApps ?? rec.apps,
    lgGoals: rec.lgGoals ?? rec.goals,
    caps: rec.caps ?? 0,
    comps: (rec.comps ?? []).map((c) => ({
      type: c.type,
      name: c.name,
      stage: c.stage,
      apps: c.apps,
      g: c.g,
      a: c.a,
    })),
    ch: rec.ch ?? [],
  };
}

type OutboxApi = Pick<typeof Outbox, 'enqueueSeason' | 'enqueueRetirement'>;

export interface UploaderHost {
  /** 업로드 큐 모듈(설정을 마친 것). */
  outbox(): Promise<OutboxApi>;
  /** 빌드 버전(웹은 커밋 SHA). */
  appVersion: string;
  /** 지난 업로드 이후의 조작 요약(자동 플레이 탐지, 관찰 전용). 없으면 싣지 않는다. */
  signals?(): PlaySignals;
}

export function createUploader(host: UploaderHost) {
  function seasonBody(
    s: GameState,
    rec: CareerRecord,
    events: PutCareerSeasonBody['events'],
  ): PutCareerSeasonBody {
    return {
      career: {
        pos: s.pos,
        ...(s.dpos && { dpos: s.dpos }),
        ...(s.nation && { nation: s.nation }),
        ...(s.body && { height: s.body.h, weight: s.body.w }),
        foot: s.foot,
        type: s.type,
        trait: s.trait,
        startYear: s.career[0]?.year ?? rec.year,
        appVersion: host.appVersion,
        // T-11-030 처음 스카우트 평가는 첫 시즌 기록과 함께만 보낸다(재평가가 21세에 pot을 바꾸기 전 값).
        // 웹은 s가 $state 프록시라 s.career[0]과 rec가 같은 객체여도 ===가 거짓이므로 연도로 비교한다.
        ...(rec.year === s.career[0]?.year && (s.flags.rescout ?? 0) === 0 && { pot: s.pot }),
      },
      season: seasonPayload(rec),
      events,
      publicName: publicNameOf(s.name),
    };
  }

  // T-9-009: 시즌 종료 직후(RNG 소모 없는 지점) 커리어 요약 + 버퍼링된 선택 로그를 업로드 큐에 넣는다.
  function uploadSeason(s: GameState, rec: CareerRecord) {
    const events = (s.evBuf || []).slice();
    s.evBuf = [];
    const signals = host.signals?.();
    void host.outbox().then((m) =>
      m.enqueueSeason(s.cid, rec.year, {
        ...seasonBody(s, rec, events),
        ...(signals && { signals }),
      }),
    );
  }

  /** 은퇴 요약 + 상세 스냅샷을 서버 명예의 전당으로 보낸다. 이름은 `entry.public`일 때만 보낸다(은퇴 때 환경설정 '선수 이름 공개'를 따름, T-10-065). */
  function uploadRetirement(careerId: string, entry: HofEntry) {
    void host.outbox().then((m) => m.enqueueRetirement(careerId, retirementBody(entry)));
  }

  /** 커리어의 모든 시즌을 지금 cid로 업로드 큐에 넣는다. eventsOf: 연도별 선택 로그(남아 있는 것만). */
  function enqueueAllSeasons(
    m: OutboxApi,
    s: GameState,
    eventsOf: (year: number) => PutCareerSeasonBody['events'] = () => [],
  ) {
    for (const rec of s.career)
      m.enqueueSeason(s.cid, rec.year, seasonBody(s, rec, eventsOf(rec.year)));
  }

  /** cid 도입 전에 은퇴한 선수: 서버엔 이 커리어가 없어 은퇴만 보내면 CAREER_NOT_FOUND(400)로 버려진다 — 시즌을
   * 먼저 큐에 넣어 커리어를 만든 뒤 은퇴를 보낸다(큐는 넣은 순서대로 보낸다). 선택 로그는 남아 있지 않다. */
  function uploadLegacyRetirement(s: GameState, entry: HofEntry) {
    void host.outbox().then((m) => {
      enqueueAllSeasons(m, s);
      m.enqueueRetirement(s.cid, retirementBody(entry));
    });
  }

  return { uploadSeason, uploadRetirement, enqueueAllSeasons, uploadLegacyRetirement };
}

function retirementBody(entry: HofEntry): PutRetirementBody {
  return {
    retireAge: entry.age,
    peak: entry.peak,
    legendScore: entry.score,
    apps: entry.apps,
    goals: entry.goals,
    assists: entry.assists,
    trophies: entry.trophies,
    awards: entry.awards,
    caps: entry.caps,
    ballon: entry.ballon,
    lastClub: entry.lastClub,
    lastClubId: entry.lastClubId,
    title: entry.title ?? null,
    publicName: entry.public ? toPublicName(entry.name) : null,
    ...(entry.detail ? { snapshot: entry.detail } : {}),
    ...(entry.profile ? { profile: entry.profile } : {}),
    ...(entry.pot !== undefined ? { potReal: entry.pot } : {}),
  };
}
