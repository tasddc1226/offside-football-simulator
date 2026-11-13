import {
  fetchOpponents,
  playLiveMatch,
  type OwnerTeam,
  type PlayTeamMatchResponse,
  type TeamMatch,
  type TeamOpponent,
  type TeamLive as TeamLiveData,
} from '@offside/app-core/api/team';
import { usesRankLadder } from '@offside/contracts/owner-team';
import { markDivisionSeen, type DivisionShift } from '@offside/app-core/teamDivision';
import { streakStep, type StreakHint } from '@offside/app-core/losingStreak';
import { loadKey, saveKey } from '@offside/game/storage';
import type { TeamView } from '@offside/app-core/state';
import type { LoadStatus } from '../loadStatus.js';
import { toast } from '../helpers.js';

type MatchHost = {
  team: () => OwnerTeam | null;
  season: () => number;
  setMatchesLeft: (left: number) => void;
  setMatchesNextAt: (at: string | null) => void;
  clearDivisionNotice: () => void;
  show: (view: TeamView) => void;
  openHistoryResult: () => void;
};

/** T-11-722 랭크 연패 기록(이 기기에만). */
const STREAK_KEY = 'ft_rank_streak';

/** Ranked/friendly result state. Team retains editing and tab-entry fetch triggers. */
export function createTeamMatches(host: MatchHost) {
  const state = $state({
    opponents: [] as TeamOpponent[],
    oppStatus: 'loading' as LoadStatus,
    oppPick: 0,
    rankFound: null as TeamOpponent | null,
    playing: false,
    result: null as TeamMatch | null,
    divisionShift: null as DivisionShift | null,
    /** T-11-722 방금 마감한 경기에 보일 연패 안내(기록에서 연 경기 · 친선전은 null). */
    streakHint: null as StreakHint | null,
    resultOrigin: 'opponents' as 'opponents' | 'history',
    live: false,
    liveMoments: undefined as TeamLiveData | undefined,
    friendlyLeft: 0,
  });
  async function loadOpponents() {
    state.oppStatus = 'loading';
    const r = await fetchOpponents(state.oppPick);
    if (!r.ok) {
      state.oppStatus = 'error';
      return;
    }
    state.opponents = r.data.items;
    state.oppStatus = 'ready';
  }

  async function challenge(o: TeamOpponent) {
    if (state.playing) return;
    state.playing = true;
    // T-11-387 랭크 경기는 문자중계 도중 장면을 고르는 경기로 시작한다(결과는 중계가 끝날 때 onfinal로 온다).
    const r = await playLiveMatch(o.teamId);
    state.playing = false;
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') host.setMatchesLeft(0);
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT') {
        state.opponents = state.opponents.filter((x) => x.teamId !== o.teamId);
        state.rankFound = null;
      }
      // T-11-510 상대 RP가 그새 멀어졌다 — 같은 횟수로 새 상대를 받는다(T-11-603 시즌 2는 큐로 돌아가 다시 찾는다).
      if (r.error.reason === 'TEAM_OPPONENT_STALE') {
        if (usesRankLadder(host.team()?.season ?? 0)) state.rankFound = null;
        else void loadOpponents();
      }
      return toast(r.error.message);
    }
    state.oppPick = 0;
    state.rankFound = null;
    state.result = r.data.match;
    // 고를 장면이 없는 경기는 시작 응답이 곧 마감이다(중계가 onfinal을 부르지 않는다).
    state.streakHint = r.data.live ? null : noteStreak(r.data.match);
    state.liveMoments = r.data.live;
    state.resultOrigin = 'opponents';
    state.live = true;
    host.setMatchesLeft(r.data.matchesLeft);
    host.setMatchesNextAt(r.data.matchesNextAt ?? null);
    host.clearDivisionNotice();
    applyPlayed(r.data);
    host.show('result');
    window.scrollTo(0, 0);
  }

  /** T-11-722 마감한 경기를 연패 기록에 더하고 이 결과에 보일 안내를 돌려준다. */
  function noteStreak(m: TeamMatch): StreakHint | null {
    const r = streakStep(loadKey<string>(STREAK_KEY), m);
    if (r.raw !== null) saveKey(STREAK_KEY, r.raw);
    return r.hint;
  }

  /** 경기 결과의 기록 · 레이팅을 내 팀에 반영한다(장면 경기는 시작 때 경기 전 값, 끝날 때 결과 값이 온다). */
  function applyPlayed(r: PlayTeamMatchResponse) {
    // T-11-375 승격 · 강등 띠는 마감한 결과에만 온다(장면 경기 시작 응답에는 없다).
    state.divisionShift = r.division ?? null;
    const team = host.team();
    if (!team) return;
    team.record = r.record;
    team.rating = r.rating;
    if (r.division) {
      team.division = r.division.to;
      markDivisionSeen(host.season(), r.division.to);
    }
  }

  /** 장면 경기가 끝났다 — 결과 화면을 마감한 경기로 바꾼다. */
  function liveFinal(r: PlayTeamMatchResponse) {
    state.result = r.match;
    state.liveMoments = undefined;
    state.streakHint = noteStreak(r.match);
    host.setMatchesLeft(r.matchesLeft);
    host.setMatchesNextAt(r.matchesNextAt ?? null);
    applyPlayed(r);
  }

  // T-11-098 친선전 결과(방금 치른 경기는 중계부터, 최근 친선전은 결과부터). 결과에서 돌아가면 '경기' 탭의 친구 쪽이다.
  function openFriendly(m: TeamMatch, left: number, fresh: boolean) {
    state.result = m;
    state.divisionShift = null;
    state.streakHint = null;
    state.resultOrigin = 'opponents';
    state.live = fresh;
    state.friendlyLeft = left;
    host.show('result');
    window.scrollTo(0, 0);
  }

  function openHistoryMatch(m: TeamMatch) {
    state.result = m;
    state.divisionShift = null;
    state.streakHint = null;
    state.resultOrigin = 'history';
    state.live = false;
    host.openHistoryResult();
  }
  return { state, loadOpponents, challenge, liveFinal, openFriendly, openHistoryMatch };
}
