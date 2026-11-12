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

/** Ranked/friendly result state. Team retains editing and tab-entry fetch triggers. */
export function createTeamMatches(host: MatchHost) {
  let opponents = $state<TeamOpponent[]>([]);
  let oppStatus = $state<LoadStatus>('loading');
  /** T-11-510 시즌 2 자동 매칭에서 이번 경기의 '다른 상대 찾기' 횟수(경기를 치르면 0으로). */
  let oppPick = $state(0);
  /** T-11-603 큐에서 찾은 상대(경기를 치르거나 상대가 무효가 되면 비운다). 탭을 다녀와도 남는다. */
  let rankFound = $state<TeamOpponent | null>(null);
  let playing = $state(false);
  let result = $state<TeamMatch | null>(null);
  /** T-11-375 방금 치른 경기의 내 디비전 전후(결과 창 승격 · 강등), 받은 경기로 바뀐 디비전 알림. */
  let divisionShift = $state<DivisionShift | null>(null);
  let resultOrigin = $state<'opponents' | 'history'>('opponents');
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  let live = $state(false);
  /** T-11-387 방금 시작한 장면 경기의 고를 장면(중계가 끝나면 비운다). */
  let liveMoments = $state<TeamLiveData | undefined>();
  /** T-11-098 오늘 남은 친선전(친선전 결과 화면의 '다시 경기하기'). */
  let friendlyLeft = $state(0);
  async function loadOpponents() {
    oppStatus = 'loading';
    const r = await fetchOpponents(oppPick);
    if (!r.ok) {
      oppStatus = 'error';
      return;
    }
    opponents = r.data.items;
    oppStatus = 'ready';
  }

  async function challenge(o: TeamOpponent) {
    if (playing) return;
    playing = true;
    // T-11-387 랭크 경기는 문자중계 도중 장면을 고르는 경기로 시작한다(결과는 중계가 끝날 때 onfinal로 온다).
    const r = await playLiveMatch(o.teamId);
    playing = false;
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') host.setMatchesLeft(0);
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT') {
        opponents = opponents.filter((x) => x.teamId !== o.teamId);
        rankFound = null;
      }
      // T-11-510 상대 RP가 그새 멀어졌다 — 같은 횟수로 새 상대를 받는다(T-11-603 시즌 2는 큐로 돌아가 다시 찾는다).
      if (r.error.reason === 'TEAM_OPPONENT_STALE') {
        if (usesRankLadder(host.team()?.season ?? 0)) rankFound = null;
        else void loadOpponents();
      }
      return toast(r.error.message);
    }
    oppPick = 0;
    rankFound = null;
    result = r.data.match;
    liveMoments = r.data.live;
    resultOrigin = 'opponents';
    live = true;
    host.setMatchesLeft(r.data.matchesLeft);
    host.setMatchesNextAt(r.data.matchesNextAt ?? null);
    host.clearDivisionNotice();
    applyPlayed(r.data);
    host.show('result');
    window.scrollTo(0, 0);
  }

  /** 경기 결과의 기록 · 레이팅을 내 팀에 반영한다(장면 경기는 시작 때 경기 전 값, 끝날 때 결과 값이 온다). */
  function applyPlayed(r: PlayTeamMatchResponse) {
    // T-11-375 승격 · 강등 띠는 마감한 결과에만 온다(장면 경기 시작 응답에는 없다).
    divisionShift = r.division ?? null;
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
    result = r.match;
    liveMoments = undefined;
    host.setMatchesLeft(r.matchesLeft);
    host.setMatchesNextAt(r.matchesNextAt ?? null);
    applyPlayed(r);
  }

  // T-11-098 친선전 결과(방금 치른 경기는 중계부터, 최근 친선전은 결과부터). 결과에서 돌아가면 '경기' 탭의 친구 쪽이다.
  function openFriendly(m: TeamMatch, left: number, fresh: boolean) {
    result = m;
    divisionShift = null;
    resultOrigin = 'opponents';
    live = fresh;
    friendlyLeft = left;
    host.show('result');
    window.scrollTo(0, 0);
  }

  function openHistoryMatch(m: TeamMatch) {
    result = m;
    divisionShift = null;
    resultOrigin = 'history';
    live = false;
    host.openHistoryResult();
  }
  return {
    get opponents() {
      return opponents;
    },
    get oppStatus() {
      return oppStatus;
    },
    get oppPick() {
      return oppPick;
    },
    set oppPick(value: typeof oppPick) {
      oppPick = value;
    },
    get rankFound() {
      return rankFound;
    },
    set rankFound(value: typeof rankFound) {
      rankFound = value;
    },
    get playing() {
      return playing;
    },
    get result() {
      return result;
    },
    get divisionShift() {
      return divisionShift;
    },
    get resultOrigin() {
      return resultOrigin;
    },
    get live() {
      return live;
    },
    set live(value: typeof live) {
      live = value;
    },
    get liveMoments() {
      return liveMoments;
    },
    set liveMoments(value: typeof liveMoments) {
      liveMoments = value;
    },
    get friendlyLeft() {
      return friendlyLeft;
    },
    loadOpponents,
    challenge,
    liveFinal,
    openFriendly,
    openHistoryMatch,
  };
}
