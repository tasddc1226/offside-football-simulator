// T-11-418b 리그 배치 뒤 화면 조각(웹 league/LeagueBoard.svelte · LeagueMatchDetail.svelte): 리그 고르기, 순위표(승격권 ·
// 강등권 · 기권 수), 라운드별 경기, 경기 상세(처음 열면 문자중계부터). 리그는 홈 경기라 중계에 홈 · 원정을 그대로 둔다.
// T-11-418d 확정 배지 · 리그 기록 · 마지막 라운드 동시 중계(웹 LeagueFinalLive.svelte).
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import {
  fetchLeagueMatch,
  fetchLeagueTable,
  type LeagueMatch,
  type LeagueMatchResponse,
  type LeagueTableResponse,
} from '@offside/app-core/api/league';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { cupText as C } from '@offside/app-core/i18n/ko/cup';
import { leagueText as L } from '@offside/app-core/i18n/ko/league';
import { teamMatchText as TM } from '@offside/app-core/i18n/ko/teamMatch';
import { playerName } from '@offside/app-core/format';
import {
  leagueForfeitsTag,
  LEAGUE_LIVE_END,
  leagueClinches,
  leagueFinalReady,
  leagueLastRound,
  leagueLive,
  leagueLegend,
  leagueFixtureRows,
  leagueMyMatches,
  leagueRoundSlots,
  leagueSlotMid,
  leagueStep,
  leagueTierGroups,
  leagueTitle,
  leagueRoundAt,
  leagueZoneLabel,
  leagueRecords,
  leagueRound,
  leagueZone,
  type LeagueClinch,
  type LeaguePick,
} from '@offside/app-core/leagueView';
import { cupLiveMatch, firstLive } from '@offside/app-core/teamLive';
import { leagueNewsText as N } from '@offside/app-core/i18n/ko/leagueNews';
import { derbyIds, leagueRival, matchArticle } from '@offside/app-core/leagueNews';
import { isMember } from '@offside/app-core/account';
import { useSnapshot } from 'valtio';
import { accountCache } from '../../store';
import { shareToLounge } from '../../components/loungeShare';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Pill, Press, Skeleton, Txt, scrollTo } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';
import { TeamLive } from '../owner/TeamLive';
import { LeagueEmblem, LeagueTrophy } from '../../ui/LeagueArt';

/** 머리 줄 양옆의 화살표(리그 · 라운드 넘기기). */
function Arrow({
  text,
  label,
  off,
  onPress,
  testID,
}: {
  text: string;
  label: string;
  off: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Press
      testID={testID}
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={{
        width: 44,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.3 : 1,
      }}
    >
      <Txt v="h3" bold>
        {text}
      </Txt>
    </Press>
  );
}

/** 글자 버튼('내 리그로' · '시즌 일정' · '이번 라운드로'). */
function HeadLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: 36, justifyContent: 'center' }}
    >
      <Txt v="sm" bold tone="accent">
        {label}
      </Txt>
    </Press>
  );
}

/** T-11-640 리그 고르기: 리그 이름을 크게 두고 앞뒤로 넘긴다. 이름을 누르면 부마다 묶은 이름표가 올라온다(웹 LeaguePicker.svelte와 같은 구성). */
export function LeaguePicker({
  tiers,
  pick,
  mine,
  onpick,
}: {
  tiers: readonly { tier: number; leagues: number }[];
  pick: LeaguePick;
  mine: LeaguePick | null;
  onpick: (p: LeaguePick) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const groups = leagueTierGroups(tiers);
  const flat = groups.flatMap((g) => g.leagues);
  if (flat.length < 2) return null;
  const prev = leagueStep(flat, pick, -1);
  const next = leagueStep(flat, pick, 1);
  const isMine = !!mine && mine.tier === pick.tier && mine.league === pick.league;
  const choose = (p: LeaguePick) => {
    setOpen(false);
    onpick({ tier: p.tier, league: p.league });
  };
  return (
    <Card gap={4} testID="league-picker">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Arrow
          text="‹"
          label={L.leaguePrev}
          off={!prev}
          onPress={() => prev && choose(prev)}
          testID="league-prev"
        />
        <Press
          testID="league-pick-open"
          accessibilityLabel={`${L.pickLeague} · ${leagueTitle(pick)}`}
          onPress={() => setOpen(true)}
          style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}
        >
          <LeagueEmblem tier={pick.tier} league={pick.league} size={52} />
          <Txt v="xs" tone="muted">
            {`${L.tierName({ tier: pick.tier })}${isMine ? ` · ${L.myLeague}` : ''}`}
          </Txt>
          <Txt v="h3" bold testID={`league-picked-${pick.tier}-${pick.league}`}>
            {`${leagueTitle(pick)} ▾`}
          </Txt>
        </Press>
        <Arrow
          text="›"
          label={L.leagueNext}
          off={!next}
          onPress={() => next && choose(next)}
          testID="league-next"
        />
      </View>
      <View
        testID="league-trophy-row"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: c.line,
        }}
      >
        <LeagueTrophy tier={pick.tier} league={pick.league} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="sm" bold>
            {L.trophyTitle}
          </Txt>
          <Txt v="xs" tone="muted">
            {L.trophyNote}
          </Txt>
        </View>
      </View>
      {mine && !isMine ? (
        <View style={{ alignItems: 'center' }}>
          <HeadLink label={L.goMyLeague} onPress={() => choose(mine)} testID="league-pick-mine" />
        </View>
      ) : null}
      {open ? (
        <PopSheet label={L.pickLeague} testID="league-pick-sheet" onClose={() => setOpen(false)}>
          <View style={{ gap: 16 }}>
            <Txt v="h3" bold accessibilityRole="header">
              {L.pickLeague}
            </Txt>
            {groups.map((g) => (
              <View key={g.tier} style={{ gap: 8 }}>
                <Txt v="sm" tone="muted" bold>
                  {g.label}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {g.leagues.map((l) => {
                    const on = l.tier === pick.tier && l.league === pick.league;
                    const own = mine?.tier === l.tier && mine.league === l.league;
                    return (
                      <Press
                        key={l.league}
                        testID={`league-pick-${l.tier}-${l.league}`}
                        accessibilityState={{ selected: on }}
                        onPress={() => choose(l)}
                        style={{
                          flexBasis: g.leagues.length === 1 ? '100%' : '48%',
                          flexGrow: 1,
                          minHeight: 48,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          paddingHorizontal: 10,
                          borderRadius: RADIUS.sm,
                          borderWidth: on ? 2 : 1,
                          borderColor: on ? c.accent : c.line,
                          backgroundColor: c.surface,
                        }}
                      >
                        <LeagueEmblem tier={l.tier} league={l.league} size={28} />
                        <View style={{ flex: 1 }}>
                          <Txt v="sm" bold={on}>
                            {l.title}
                          </Txt>
                          {own ? (
                            <Txt v="xs" bold tone="accent">
                              {L.myLeague}
                            </Txt>
                          ) : null}
                        </View>
                      </Press>
                    );
                  })}
                </View>
              </View>
            ))}
            <Btn block onPress={() => setOpen(false)} testID="league-pick-close">
              {L.sheetClose}
            </Btn>
          </View>
        </PopSheet>
      ) : null}
    </Card>
  );
}

/** T-11-640 순위표 위 '내 경기': 지난 경기(바로 보기)와 다음 경기(웹 data-league-my와 같은 구성). */
function MyMatches({
  table,
  mineId,
  onopen,
}: {
  table: LeagueTableResponse;
  mineId: string | null;
  onopen: (m: LeagueMatch) => void;
}) {
  const c = useColors();
  const my = leagueMyMatches(table, mineId);
  // T-11-652 내 라이벌(바로 위 · 아래 팀 중 승점 차가 작은 팀).
  const rival = leagueRival(table, mineId);
  if (!my) return null;
  const who = (head: string, x: NonNullable<typeof my.last>) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Txt v="xs" tone="muted">
        {`${head} · ${L.roundName({ n: x.match.round })}`}
      </Txt>
      <Txt v="sm">{`${x.opponent} · ${x.side}`}</Txt>
    </View>
  );
  const row = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 8,
  } as const;
  return (
    <Card gap={8} testID="league-my">
      <Txt v="h3" bold accessibilityRole="header">
        {L.myMatchTitle}
      </Txt>
      {my.last ? (
        <View style={row} testID="league-my-last">
          {who(L.myMatchLast, my.last)}
          <Txt
            bold
            num
            tone={my.last.result === 'w' ? 'good' : my.last.result === 'l' ? 'warn' : 'ink'}
            style={{ fontFamily: DISPLAY[700] }}
          >
            {my.last.score}
          </Txt>
          {my.last.watch ? (
            <Btn onPress={() => onopen(my.last!.match)} testID="league-my-watch">
              {L.myMatchWatch}
            </Btn>
          ) : null}
        </View>
      ) : null}
      {rival ? (
        <View style={row} testID={`league-rival-${rival.teamId}`}>
          <Txt v="sm" style={{ flex: 1 }}>
            {rival.line}
          </Txt>
        </View>
      ) : null}
      {my.next ? (
        <View style={row} testID="league-my-next">
          {who(L.myMatchNext, my.next)}
          <Txt v="xs" tone="muted">
            {my.next.when}
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

function Standings({
  table,
  bottomTier,
  mineId,
  onteam,
}: {
  table: LeagueTableResponse;
  bottomTier: number;
  mineId: string | null;
  onteam: (teamId: string) => void;
}) {
  const c = useColors();
  const num = (w: number) => ({ width: w, textAlign: 'right' as const });
  const head = (text: string, w: number) => (
    <Txt v="xs" tone="muted" style={num(w)}>
      {text}
    </Txt>
  );
  const rows = [...table.standings].sort((a, b) => a.rank - b.rank);
  const rivalId = leagueRival(table, mineId)?.teamId ?? null;
  const clinches = leagueClinches(table, table.tier, bottomTier);
  const legend = leagueLegend(table.tier, bottomTier);
  return (
    <Card gap={8} testID={`league-table-${table.tier}-${table.league}`}>
      <Txt v="h3" bold accessibilityRole="header">
        {L.standingsTitle}
      </Txt>
      <View style={{ gap: 2 }} accessibilityLabel={L.standingsTitle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
          <View style={{ width: 18 }} />
          <Txt v="xs" tone="muted" style={{ flex: 1 }}>
            {C.thTeam}
          </Txt>
          {head(C.thP, 22)}
          {head(C.thW, 18)}
          {head(C.thD, 18)}
          {head(C.thL, 18)}
          {head(C.thGd, 30)}
          {head(C.thPts, 26)}
        </View>
        {rows.map((s) => {
          const team = table.teams.find((t) => t.teamId === s.teamId);
          const mine = s.teamId === mineId;
          const zone = leagueZone(s.rank, rows.length, table.tier, bottomTier);
          const zoneLabel = mine ? leagueZoneLabel(zone, clinches.has(s.teamId)) : null;
          const cell = (value: string | number, w: number, bold = false) => (
            <Txt v="sm" bold={bold || mine} num style={num(w)}>
              {String(value)}
            </Txt>
          );
          const gd = s.gf - s.ga;
          return (
            <View
              key={s.teamId}
              testID={`league-rank-${s.rank}${zone ? `-${zone}` : ''}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                minHeight: 44,
                paddingVertical: 6,
                paddingHorizontal: 6,
                borderRadius: RADIUS.sm,
                backgroundColor:
                  zone === 'up'
                    ? alpha(c.good, 0.14)
                    : zone === 'down'
                      ? alpha(c.warn, 0.12)
                      : 'transparent',
              }}
            >
              <Press
                disabled={!team}
                scale={0.985}
                onPress={() => onteam(s.teamId)}
                testID={`league-team-open-${s.rank}`}
                accessibilityRole="button"
                accessibilityLabel={team ? C.teamProfileOpen({ team: team.name }) : undefined}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                  minHeight: 44,
                }}
              >
                <Txt v="sm" bold style={{ width: 16 }}>
                  {String(s.rank)}
                </Txt>
                <TeamLogo logo={team?.logo} name={team?.name ?? C.tbd} size={24} decorative />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Txt v="sm" bold={mine} tone={mine ? 'accent' : 'ink'}>
                      {team?.name ?? C.tbd}
                    </Txt>
                    <ClinchPill clinch={clinches.get(s.teamId)} />
                    {rivalId === s.teamId ? (
                      <View testID="league-rival-tag">
                        <Pill tone="warn">{N.rivalTag}</Pill>
                      </View>
                    ) : null}
                    {zoneLabel ? (
                      <View testID="league-my-zone">
                        <Pill tone={zone === 'up' ? 'good' : 'warn'}>{zoneLabel}</Pill>
                      </View>
                    ) : null}
                  </View>
                  <Txt v="xs" tone="muted">
                    {`${C.teamOwnerLabel} ${team?.owner ?? C.tbd}${s.forfeits || mine ? ` · ${leagueForfeitsTag(s.forfeits)}` : ''}`}
                  </Txt>
                </View>
              </Press>
              {cell(s.p, 22)}
              {cell(s.w, 18)}
              {cell(s.d, 18)}
              {cell(s.l, 18)}
              {cell(gd > 0 ? `+${gd}` : gd, 30)}
              {cell(s.pts, 26, true)}
            </View>
          );
        })}
      </View>
      <Txt v="xs" tone="muted">
        {[legend.up ? L.zoneUp : null, legend.down ? L.zoneDown : null, legend.move]
          .filter(Boolean)
          .join(' · ')}
      </Txt>
      {clinches.size ? (
        <Txt v="xs" tone="muted">
          {L.clinchNote}
        </Txt>
      ) : null}
    </Card>
  );
}

const CLINCH: Record<LeagueClinch, { text: string; tone?: 'good' | 'warn' }> = {
  champion: { text: L.clinchChampion, tone: 'good' },
  up: { text: L.clinchUp, tone: 'good' },
  safe: { text: L.clinchSafe },
  down: { text: L.clinchDown, tone: 'warn' },
};

function ClinchPill({ clinch }: { clinch: LeagueClinch | undefined }) {
  if (!clinch) return null;
  return (
    <View testID={`league-clinch-${clinch}`}>
      <Pill tone={CLINCH[clinch].tone}>{CLINCH[clinch].text}</Pill>
    </View>
  );
}

/** T-11-418d 리그 기록: 득점 순위 · 최다 연승 · 최장 무패. 기록이 없으면 그리지 않는다. */
function Records({ table }: { table: LeagueTableResponse }) {
  const c = useColors();
  const { winStreak, unbeaten } = leagueRecords(table);
  const scorers = table.scorers ?? [];
  if (!scorers.length && !winStreak && !unbeaten) return null;
  const name = (id: string) => table.teams.find((t) => t.teamId === id)?.name ?? C.tbd;
  const run = (label: string, r: NonNullable<typeof winStreak>, id: string) => (
    <View
      testID={`league-run-${id}`}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
    >
      <Txt v="sm" tone="muted">
        {label}
      </Txt>
      <Txt v="sm" style={{ flexShrink: 1, textAlign: 'right' }}>
        {L.runValue({ team: name(r.teamId), n: r.n })}
      </Txt>
    </View>
  );
  return (
    <Card gap={8} testID="league-records">
      <Txt v="h3" bold accessibilityRole="header">
        {L.recordsTitle}
      </Txt>
      {scorers.length ? (
        <View>
          <Txt v="sm" bold>
            {L.topScorers}
          </Txt>
          {scorers.map((p, i) => (
            <View
              key={i}
              testID="league-scorer"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minHeight: 44,
                borderTopWidth: 1,
                borderTopColor: c.line,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="sm" bold>
                  {playerName(p.name, p.pos, p.number)}
                </Txt>
                <Txt v="xs" tone="muted">
                  {name(p.teamId)}
                </Txt>
              </View>
              <Txt v="sm" bold num>
                {L.goalsN({ n: p.goals })}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      {winStreak ? run(L.winStreak, winStreak, 'win') : null}
      {unbeaten ? run(L.unbeatenRun, unbeaten, 'unbeaten') : null}
    </Card>
  );
}

/** 1분이 흐르는 시간(ms). 90분이 36초(웹과 같다). */
const LIVE_MINUTE_MS = 400;

/**
 * T-11-418d 마지막 라운드 동시 중계: 같은 리그 경기를 한 시계로 흘리며 골이 들어가면 순위표를 다시 센다. 결과는 이미 정해졌고
 * 보여 주기만 한다. '결과 바로 보기'로 언제든 끝낸다.
 */
function FinalLive({
  table,
  mineId,
  onclose,
}: {
  table: LeagueTableResponse;
  mineId: string | null;
  onclose: () => void;
}) {
  const c = useColors();
  const [minute, setMinute] = useState(0);
  const [runId, setRunId] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    setMinute(0);
    timer.current = setInterval(
      () =>
        setMinute((m) => {
          const next = Math.min(LEAGUE_LIVE_END, m + 1);
          if (next >= LEAGUE_LIVE_END && timer.current) clearInterval(timer.current);
          return next;
        }),
      LIVE_MINUTE_MS,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId]);
  const ended = minute >= LEAGUE_LIVE_END;
  const skip = () => {
    if (timer.current) clearInterval(timer.current);
    setMinute(LEAGUE_LIVE_END);
  };
  const live = leagueLive(table, minute);
  const matches = table.matches.filter((m) => m.round === leagueLastRound(table));
  const name = (id: string) => table.teams.find((t) => t.teamId === id)?.name ?? C.tbd;
  return (
    <Card gap={10} testID="league-live">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h3" bold accessibilityRole="header" style={{ flex: 1 }}>
          {L.finalLive}
        </Txt>
        <Txt bold num testID="league-clock" style={{ fontFamily: DISPLAY[700] }}>
          {ended ? L.liveFullTime : L.liveClock({ minute })}
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        {L.finalLiveNote}
      </Txt>
      {matches.map((m) => {
        const sc = live.scores.get(m.id);
        const mine = m.homeTeamId === mineId || m.awayTeamId === mineId;
        const fresh = !!m.goals?.some((g) => g.minute <= minute && g.minute > minute - 2);
        return (
          <View
            key={m.id}
            testID={`league-live-match-${m.id}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Txt v="sm" bold={mine} style={{ flex: 1, minWidth: 0 }}>
              {name(m.homeTeamId)}
            </Txt>
            <Txt
              bold
              num
              tone={fresh ? 'accent' : 'ink'}
              style={{ fontFamily: DISPLAY[700], minWidth: 56, textAlign: 'center' }}
            >
              {`${sc?.home ?? 0} : ${sc?.away ?? 0}`}
            </Txt>
            <Txt v="sm" bold={mine} style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              {name(m.awayTeamId)}
            </Txt>
          </View>
        );
      })}
      <Txt v="sm" bold>
        {L.liveTable}
      </Txt>
      {live.rows.map((r) => {
        const mine = r.teamId === mineId;
        return (
          <View
            key={r.teamId}
            testID={`league-live-rank-${r.rank}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 36,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Txt v="sm" tone="muted" num style={{ width: 22 }}>
              {String(r.rank)}
            </Txt>
            <Txt v="sm" bold={mine} tone={mine ? 'accent' : 'ink'} style={{ flex: 1, minWidth: 0 }}>
              {name(r.teamId)}
            </Txt>
            <Txt v="xs" tone={r.move > 0 ? 'good' : 'warn'}>
              {r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : ''}
            </Txt>
            <Txt v="sm" bold num style={{ width: 30, textAlign: 'right' }}>
              {String(r.pts)}
            </Txt>
          </View>
        );
      })}
      {ended ? (
        <Btn
          block
          kind="primary"
          onPress={() => setRunId((n) => n + 1)}
          testID="league-live-replay"
        >
          {L.liveReplay}
        </Btn>
      ) : (
        <Btn block kind="primary" onPress={skip} testID="league-live-skip">
          {L.liveSkip}
        </Btn>
      )}
      <Btn block onPress={onclose} testID="league-live-close">
        {L.liveClose}
      </Btn>
    </Card>
  );
}

function Rounds({
  table,
  round,
  thisRound,
  setRound,
  mineId,
  onopen,
  onlive,
}: {
  table: LeagueTableResponse;
  round: number;
  /** 다음에 치를 라운드. '이번 라운드로'가 여기로 돌아온다. */
  thisRound: number;
  setRound: (n: number) => void;
  mineId: string | null;
  onopen: (m: LeagueMatch) => void;
  onlive: () => void;
}) {
  const c = useColors();
  const day = leagueRound(table, round);
  const roundAt = leagueRoundAt(day.matches);
  const name = (id: string) => table.teams.find((t) => t.teamId === id)?.name ?? C.tbd;
  const last = leagueLastRound(table);
  const derbies = derbyIds(table);
  const [fixtures, setFixtures] = useState(false);
  const [nowY, setNowY] = useState<number | undefined>();
  const pickRound = (n: number) => {
    setRound(n);
    setFixtures(false);
  };
  return (
    <Card gap={8} testID="league-rounds">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Arrow
          text="‹"
          label={L.roundPrev}
          off={round <= 1}
          onPress={() => pickRound(round - 1)}
          testID="league-round-prev"
        />
        <View
          style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}
        >
          <Txt v="h3" bold accessibilityRole="header" testID={`league-round-${round}`}>
            {L.roundName({ n: round })}
          </Txt>
          {roundAt ? (
            <Txt v="xs" tone="muted" testID="league-round-at" style={{ textAlign: 'center' }}>
              {roundAt}
            </Txt>
          ) : null}
        </View>
        <Arrow
          text="›"
          label={L.roundNext}
          off={round >= last}
          onPress={() => pickRound(round + 1)}
          testID="league-round-next"
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
        <HeadLink
          label={L.fixtureOpen}
          onPress={() => {
            setNowY(undefined);
            setFixtures(true);
          }}
          testID="league-fixtures-open"
        />
        {round !== thisRound ? (
          <HeadLink
            label={L.goThisRound}
            onPress={() => pickRound(thisRound)}
            testID="league-round-now"
          />
        ) : null}
      </View>
      {leagueRoundSlots(day.matches).map((slot) => (
        <View key={slot.at} testID={`league-slot-${slot.time}`}>
          <Txt v="sm" bold tone="muted" num style={{ fontFamily: DISPLAY[700], marginBottom: 2 }}>
            {slot.time}
          </Txt>
          {slot.matches.map((m) => {
            const mine = m.homeTeamId === mineId || m.awayTeamId === mineId;
            const open = m.played && !m.forfeit;
            const mid = (
              <View style={{ alignItems: 'center', minWidth: 64 }}>
                <Txt bold num style={{ fontFamily: DISPLAY[700] }}>
                  {leagueSlotMid(m)}
                </Txt>
                {m.forfeit ? (
                  <Txt v="xs" tone="warn">
                    {L.forfeitScore}
                  </Txt>
                ) : null}
                {derbies.has(m.id) ? (
                  <View testID={`league-derby-${m.id}`}>
                    <Pill tone="warn">{N.derbyTag}</Pill>
                  </View>
                ) : null}
              </View>
            );
            return (
              <View
                key={m.id}
                testID={`league-match-${m.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  borderTopWidth: 1,
                  borderTopColor: c.line,
                }}
              >
                <Txt v="sm" bold={mine} style={{ flex: 1, minWidth: 0 }}>
                  {name(m.homeTeamId)}
                </Txt>
                {open ? (
                  <Press
                    onPress={() => onopen(m)}
                    testID={`league-match-open-${m.id}`}
                    accessibilityRole="button"
                    style={{
                      minHeight: 44,
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: c.line,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    {mid}
                  </Press>
                ) : (
                  mid
                )}
                <Txt v="sm" bold={mine} style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  {name(m.awayTeamId)}
                </Txt>
              </View>
            );
          })}
        </View>
      ))}
      {day.resting.map((t) => (
        <Txt key={t.teamId} v="sm" tone="muted">
          {L.restTeam({ team: t.name })}
        </Txt>
      ))}
      {round === leagueLastRound(table) && leagueFinalReady(table) ? (
        <Btn block kind="primary" onPress={onlive} testID="league-final-live">
          {L.finalLive}
        </Btn>
      ) : null}
      {fixtures ? (
        <PopSheet
          label={L.fixtureTitle}
          testID="league-fixtures"
          scrollY={nowY}
          onClose={() => setFixtures(false)}
        >
          <Txt v="h3" bold accessibilityRole="header" style={{ marginBottom: 8 }}>
            {L.fixtureTitle}
          </Txt>
          {leagueFixtureRows(table, mineId, thisRound).map((f) => (
            <Press
              key={f.round}
              testID={`league-fixture-${f.round}`}
              onPress={() => {
                if (f.mine && !f.mine.rest && f.mine.watch) {
                  setFixtures(false);
                  onopen(f.mine.watch);
                } else pickRound(f.round);
              }}
              onLayout={
                f.state === 'now'
                  ? (e) => setNowY(Math.max(0, e.nativeEvent.layout.y - 160))
                  : undefined
              }
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 8,
                borderTopWidth: 1,
                borderTopColor: c.line,
                ...(f.state === 'now'
                  ? {
                      backgroundColor: alpha(c.accent, 0.12),
                      borderLeftWidth: 3,
                      borderLeftColor: c.accent,
                    }
                  : null),
              }}
            >
              <View style={{ minWidth: 96, gap: 2 }}>
                <Txt v="sm" bold tone={f.round === round ? 'accent' : 'ink'}>
                  {L.roundName({ n: f.round })}
                </Txt>
                <Txt v="xs" tone="muted">
                  {f.day}
                </Txt>
              </View>
              {f.mine && !f.mine.rest ? (
                <>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Txt v="sm">{f.mine.opponent}</Txt>
                    <Txt v="xs" tone="muted">
                      {f.mine.side}
                    </Txt>
                  </View>
                  <Txt
                    bold
                    num
                    tone={f.mine.result === 'w' ? 'good' : f.mine.result === 'l' ? 'warn' : 'ink'}
                    style={{ fontFamily: DISPLAY[700] }}
                  >
                    {f.mine.mid}
                  </Txt>
                </>
              ) : (
                <Txt v="xs" tone="muted" style={{ flex: 1, textAlign: 'right' }}>
                  {f.mine
                    ? L.fixtureRest
                    : f.state === 'now'
                      ? L.fixtureNow
                      : f.state === 'done'
                        ? L.fixtureDone
                        : L.fixtureLater}
                </Txt>
              )}
            </Press>
          ))}
          <View style={{ marginTop: 12 }}>
            <Btn block onPress={() => setFixtures(false)} testID="league-fixtures-close">
              {L.sheetClose}
            </Btn>
          </View>
        </PopSheet>
      ) : null}
    </Card>
  );
}

/** 고른 리그 하나: 순위표 + 라운드. 리그를 바꾸면 새로 부른다(메모 60초). */
export function LeagueBoard({
  season,
  pick,
  bottomTier,
  mineId,
  round,
  thisRound,
  setRound,
  onopen,
  onteam,
}: {
  season: number;
  pick: LeaguePick;
  bottomTier: number;
  mineId: string | null;
  round: number;
  thisRound: number;
  setRound: (n: number) => void;
  onopen: (m: LeagueMatch, table: LeagueTableResponse) => void;
  onteam: (teamId: string) => void;
}) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [table, setTable] = useState<LeagueTableResponse | null>(null);
  const [live, setLive] = useState(false);
  const load = async () => {
    setStatus('loading');
    const r = await fetchLeagueTable(season, pick.tier, pick.league);
    if (r.ok) setTable(r.data);
    setStatus(r.ok ? 'ready' : 'error');
  };
  useEffect(() => {
    setTable(null);
    setLive(false);
    void load();
    // 리그가 바뀔 때만.
  }, [season, pick.tier, pick.league]);
  if (!table)
    return status === 'error' ? (
      <Card gap={10}>
        <LoadState status={status} failText={L.tableFail} retry={() => void load()}>
          {null}
        </LoadState>
      </Card>
    ) : (
      <Skeleton height={320} />
    );
  if (live)
    return (
      <FinalLive
        table={table}
        mineId={mineId}
        onclose={() => {
          setLive(false);
          scrollTo(0);
        }}
      />
    );
  return (
    <>
      <MyMatches table={table} mineId={mineId} onopen={(m) => onopen(m, table)} />
      <Standings table={table} bottomTier={bottomTier} mineId={mineId} onteam={onteam} />
      <Rounds
        table={table}
        round={round}
        thisRound={thisRound}
        setRound={setRound}
        mineId={mineId}
        onopen={(m) => onopen(m, table)}
        onlive={() => {
          setLive(true);
          scrollTo(0);
        }}
      />
      <Records table={table} />
    </>
  );
}

export function LeagueMatchDetail({
  season,
  matchId,
  table,
  mineId,
  back,
}: {
  season: number;
  matchId: string;
  table: LeagueTableResponse;
  mineId: string | null;
  back: () => void;
}) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<LeagueMatchResponse | null>(null);
  const [live, setLive] = useState(false);
  const load = async () => {
    setStatus('loading');
    const r = await fetchLeagueMatch(season, matchId);
    if (r.ok) {
      setData(r.data);
      setLive(firstLive(matchId));
    }
    setStatus(r.ok ? 'ready' : 'error');
  };
  useEffect(() => {
    void load();
    // 경기가 바뀔 때만.
  }, [season, matchId]);
  const m = data?.match;
  const info = data?.league;
  const cache = useSnapshot(accountCache);
  const acct = cache.value;
  const linked = !!acct && acct !== 'error' && isMember(acct);
  const [sharing, setSharing] = useState(false);
  const c = useColors();
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    await shareToLounge({ kind: 'leagueMatch', season, matchId });
    setSharing(false);
  };
  const article = m ? matchArticle(m) : null;
  const owner = (id: string, fallback: string) =>
    table.teams.find((t) => t.teamId === id)?.owner ?? fallback;
  const goalStyle = { fontFamily: DISPLAY[700], fontSize: rem(2.5), lineHeight: rem(2.5) } as const;
  const side = (s: NonNullable<typeof m>['home'], away: boolean) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: away ? 'flex-end' : 'flex-start' }}>
      <TeamLogo logo={s.logo} name={s.name} size={40} decorative />
      <Txt bold style={{ textAlign: away ? 'right' : 'left' }}>
        {s.name}
      </Txt>
      <Txt tone="muted" v="xs" style={{ textAlign: away ? 'right' : 'left' }}>
        {`${owner(s.teamId, s.owner)} · OVR ${s.ovr}`}
      </Txt>
    </View>
  );
  if (m && live) {
    const v = cupLiveMatch(m, mineId);
    return (
      <TeamLive
        key={`${m.id}-live`}
        match={v.match}
        neutral={v.neutral}
        name={(_, fallback) => fallback}
        onend={() => {
          setLive(false);
          scrollTo(0);
        }}
      />
    );
  }
  return (
    <Card gap={14} testID="league-match-detail">
      <View>
        <Txt v="eyebrow">Full time</Txt>
        <Txt v="h1" accessibilityRole="header">
          {info
            ? L.detailTitle({ tier: info.tier, league: info.league, round: info.round })
            : L.title}
        </Txt>
      </View>
      <LoadState status={status} failText={C.detailFail} retry={() => void load()}>
        {m ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {side(m.home, false)}
              <View
                accessible
                accessibilityLabel={TM.scoreAria({ h: m.home.goals, a: m.away.goals })}
                style={{ flexDirection: 'row', gap: 8 }}
              >
                <Txt style={goalStyle}>{m.home.goals}</Txt>
                <Txt accessible={false} style={goalStyle}>
                  :
                </Txt>
                <Txt style={goalStyle}>{m.away.goals}</Txt>
              </View>
              {side(m.away, true)}
            </View>
            {article ? (
              <View
                testID="league-article"
                style={{
                  gap: 6,
                  padding: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: c.accent,
                  borderRadius: RADIUS.sm,
                  backgroundColor: alpha(c.accent, 0.06),
                }}
              >
                <Txt v="eyebrow">{N.articleTitle}</Txt>
                <Txt v="h3" bold>
                  {article.head}
                </Txt>
                {article.body.map((line) => (
                  <Txt key={line} v="sm" style={{ lineHeight: rem(1) * 1.5 }}>
                    {line}
                  </Txt>
                ))}
              </View>
            ) : null}
            {m.events.length ? (
              <View style={{ gap: 8 }}>
                {m.events.map((e, k) => (
                  <View
                    key={k}
                    style={{
                      flexDirection: e.side === 'away' ? 'row-reverse' : 'row',
                      gap: 10,
                      alignItems: 'baseline',
                    }}
                  >
                    <Txt
                      tone="muted"
                      style={{
                        minWidth: rem(1) * 2.2,
                        fontFamily: DISPLAY[700],
                        textAlign: e.side === 'away' ? 'right' : 'left',
                      }}
                    >{`${e.minute}'`}</Txt>
                    <View style={{ alignItems: e.side === 'away' ? 'flex-end' : 'flex-start' }}>
                      <Txt bold>{e.scorer}</Txt>
                      {e.assist ? (
                        <Txt tone="muted" v="xs">
                          {C.assist({ name: e.assist })}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Txt tone="muted">{C.noGoals}</Txt>
            )}
            <Txt tone="muted" v="sm">
              {kstMonthDayTime(m.createdAt)}
            </Txt>
          </>
        ) : null}
      </LoadState>
      {m ? (
        <Btn block onPress={() => setLive(true)} testID="league-replay">
          {TM.replay}
        </Btn>
      ) : null}
      {m && linked && !info?.forfeit ? (
        <Btn
          block
          disabled={sharing}
          onPress={() => void share()}
          accessibilityLabel={N.shareAria({ home: m.home.name, away: m.away.name })}
          testID="league-article-share"
        >
          {N.shareAct}
        </Btn>
      ) : null}
      <Btn block onPress={back} testID="league-match-back">
        {L.detailBack}
      </Btn>
    </Card>
  );
}
