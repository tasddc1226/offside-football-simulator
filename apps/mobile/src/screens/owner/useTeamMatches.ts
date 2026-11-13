import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
import type { StreakHint } from '@offside/app-core/losingStreak';
import type { TeamView } from '@offside/app-core/state';
import type { LoadStatus } from '../../components/LoadState';
import { toast } from '../../game/host';
import { rankStreakHint } from '../../platform/rankStreak';
import { scrollTo } from '../../ui';

type MatchHost = {
  team: OwnerTeam | null;
  season: number;
  setTeam: Dispatch<SetStateAction<OwnerTeam | null>>;
  setMatchesLeft: Dispatch<SetStateAction<number>>;
  setMatchesNextAt: Dispatch<SetStateAction<string | null>>;
  setDivisionNotice: Dispatch<SetStateAction<string | null>>;
  show: (view: TeamView) => void;
};

/** Ranked/friendly result state. Team retains editing, allowance timers and tab-entry fetch triggers. */
export function useTeamMatches({
  team,
  season,
  setTeam,
  setMatchesLeft,
  setMatchesNextAt,
  setDivisionNotice,
  show,
}: MatchHost) {
  const oppLoaded = useRef(false);
  /** T-11-510 시즌 2 자동 매칭에서 이번 경기의 '다른 상대 찾기' 횟수(경기를 치르면 0으로). */
  const [oppPick, setOppPick] = useState(0);
  const oppPickRef = useRef(0);
  /** T-11-603 큐에서 찾은 상대(경기를 치르거나 상대가 무효가 되면 비운다). 탭을 다녀와도 남는다. */
  const [rankFound, setRankFound] = useState<TeamOpponent | null>(null);
  const [opponents, setOpponents] = useState<TeamOpponent[]>([]);
  const [oppStatus, setOppStatus] = useState<LoadStatus>('loading');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<TeamMatch | null>(null);
  /** T-11-375 방금 치른 경기의 디비전 전후(결과 화면 승격 · 강등), 받은 경기로 바뀐 디비전 알림. */
  const [divisionShift, setDivisionShift] = useState<DivisionShift | null>(null);
  /** T-11-722 방금 마감한 경기에 보일 연패 안내(기록에서 연 경기 · 친선전은 null). */
  const [streakHint, setStreakHint] = useState<StreakHint | null>(null);
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  const [live, setLive] = useState(false);
  /** T-11-387 방금 시작한 장면 경기의 고를 장면(중계가 끝나면 비운다). */
  const [liveMoments, setLiveMoments] = useState<TeamLiveData | undefined>();
  const [resultOrigin, setResultOrigin] = useState<'opponents' | 'history'>('opponents');
  function openHistoryMatch(m: TeamMatch) {
    setResultOrigin('history');
    setDivisionShift(null);
    setStreakHint(null);
    setResult(m);
    setLiveMoments(undefined);
    setLive(false);
    show('result');
  }
  async function loadOpponents(silent = false) {
    oppLoaded.current = true;
    if (!silent) setOppStatus('loading');
    const r = await fetchOpponents(oppPickRef.current);
    if (!r.ok) return silent ? undefined : setOppStatus('error');
    setOpponents(r.data.items);
    setOppStatus('ready');
  }

  async function challenge(o: TeamOpponent) {
    if (playing) return;
    setPlaying(true);
    // T-11-387 랭크 경기는 문자중계 도중 장면을 고르는 경기로 시작한다(결과는 중계가 끝날 때 onfinal로 온다).
    const r = await playLiveMatch(o.teamId);
    setPlaying(false);
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') setMatchesLeft(0);
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT')
        setOpponents((list) => list.filter((x) => x.teamId !== o.teamId));
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT') setRankFound(null);
      // T-11-510 상대 RP가 그새 멀어졌다 — 같은 횟수로 새 상대를 받는다.
      if (r.error.reason === 'TEAM_OPPONENT_STALE') {
        if (usesRankLadder(team?.season ?? 0)) setRankFound(null);
        else void loadOpponents();
      }
      return toast(r.error.message);
    }
    oppPickRef.current = 0;
    setRankFound(null);
    setOppPick(0);
    setResultOrigin('opponents');
    // 고를 장면이 없는 경기는 시작 응답이 곧 마감이다(중계가 onfinal을 부르지 않는다).
    setStreakHint(r.data.live ? null : rankStreakHint(r.data.match));
    setResult(r.data.match);
    setLiveMoments(r.data.live);
    setLive(true);
    setMatchesLeft(r.data.matchesLeft);
    setMatchesNextAt(r.data.matchesNextAt ?? null);
    setDivisionNotice(null);
    applyPlayed(r.data);
    show('result');
    scrollTo(0);
  }

  /** 경기 결과의 기록 · 레이팅을 내 팀에 반영한다(장면 경기는 시작 때 경기 전 값, 끝날 때 결과 값이 온다). */
  function applyPlayed(r: PlayTeamMatchResponse) {
    // T-11-375 승격 · 강등 띠는 마감한 결과에만 온다(장면 경기 시작 응답에는 없다).
    const shift = r.division ?? null;
    setDivisionShift(shift);
    if (shift) markDivisionSeen(season, shift.to);
    setTeam((t) =>
      t
        ? {
            ...t,
            record: r.record,
            rating: r.rating,
            ...(shift ? { division: shift.to } : {}),
          }
        : t,
    );
  }

  /** 장면 경기가 끝났어요. 결과 화면을 마감한 경기로 바꾼다. */
  function liveFinal(r: PlayTeamMatchResponse) {
    setResult(r.match);
    setStreakHint(rankStreakHint(r.match));
    setLiveMoments(undefined);
    setMatchesLeft(r.matchesLeft);
    setMatchesNextAt(r.matchesNextAt ?? null);
    applyPlayed(r);
  }

  /** 친구 칸에서 친선전을 치렀거나(중계부터) 최근 친선전을 열 때(결과부터). 친선전은 레이팅·전적을 건드리지 않는다. */
  function showFriendly(m: TeamMatch, withLive: boolean) {
    setDivisionShift(null);
    setStreakHint(null);
    setResultOrigin('opponents');
    setResult(m);
    setLiveMoments(undefined);
    setLive(withLive);
    show('result');
    scrollTo(0);
  }
  return {
    oppLoaded,
    oppPick,
    oppPickRef,
    rankFound,
    setRankFound,
    opponents,
    oppStatus,
    playing,
    result,
    divisionShift,
    streakHint,
    live,
    setLive,
    liveMoments,
    setLiveMoments,
    resultOrigin,
    setOppPick,
    loadOpponents,
    challenge,
    liveFinal,
    showFriendly,
    openHistoryMatch,
  };
}
