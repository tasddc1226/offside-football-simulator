// T-11-418b 리그 배치 뒤 화면 조각(웹 league/LeagueBoard.svelte · LeagueMatchDetail.svelte): 리그 고르기, 순위표(승격권 ·
// 강등권 · 기권 수), 라운드별 경기, 경기 상세(처음 열면 문자중계부터). 리그는 홈 경기라 중계에 홈 · 원정을 그대로 둔다.
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import {
  leagueMatchMid,
  leagueRound,
  leagueZone,
  type LeaguePick,
} from '@offside/app-core/leagueView';
import { cupLiveMatch, firstLive } from '@offside/app-core/teamLive';
import { LEAGUE_ROUNDS } from '@offside/contracts/league';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Skeleton, Txt, scrollTo } from '../../ui';
import { TeamLive } from '../owner/TeamLive';

/** 가로로 넘기는 고르기 칩(리그 · 라운드). */
function Chips<T>({
  items,
  on,
  label,
  keyOf,
  pick,
  testID,
}: {
  items: readonly T[];
  on: (x: T) => boolean;
  label: (x: T) => string;
  keyOf: (x: T) => string;
  pick: (x: T) => void;
  testID: string;
}) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {items.map((x) => {
          const sel = on(x);
          return (
            <Press
              key={keyOf(x)}
              testID={`${testID}-${keyOf(x)}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              onPress={() => pick(x)}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 12,
                borderRadius: RADIUS.pill,
                borderWidth: sel ? 2 : 1,
                borderColor: sel ? c.accent : c.line,
                backgroundColor: c.surface,
              }}
            >
              <Txt v="sm" bold={sel}>
                {label(x)}
              </Txt>
            </Press>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function LeaguePicker({
  choices,
  pick,
  mine,
  onpick,
}: {
  choices: readonly LeaguePick[];
  pick: LeaguePick;
  mine: LeaguePick | null;
  onpick: (p: LeaguePick) => void;
}) {
  if (choices.length < 2) return null;
  const same = (a: LeaguePick | null, b: LeaguePick) =>
    !!a && a.tier === b.tier && a.league === b.league;
  return (
    <View style={{ gap: 6 }} accessibilityLabel={L.pickLeague}>
      <Txt v="sm" tone="muted">
        {L.pickLeague}
      </Txt>
      <Chips
        items={choices}
        on={(x) => same(pick, x)}
        label={(x) => `${L.leagueName(x)}${same(mine, x) ? ` · ${L.myLeague}` : ''}`}
        keyOf={(x) => `${x.tier}-${x.league}`}
        pick={onpick}
        testID="league-pick"
      />
    </View>
  );
}

function Standings({
  table,
  bottomTier,
  mineId,
}: {
  table: LeagueTableResponse;
  bottomTier: number;
  mineId: string | null;
}) {
  const c = useColors();
  const num = (w: number) => ({ width: w, textAlign: 'right' as const });
  const head = (text: string, w: number) => (
    <Txt v="xs" tone="muted" style={num(w)}>
      {text}
    </Txt>
  );
  const rows = [...table.standings].sort((a, b) => a.rank - b.rank);
  return (
    <Card gap={8} testID={`league-table-${table.tier}-${table.league}`}>
      <Txt v="h3" bold accessibilityRole="header">
        {L.standingsTitle}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={L.standingsTitle}>
        <View style={{ gap: 2, width: 420 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}
          >
            <View style={{ width: 18 }} />
            <Txt v="xs" tone="muted" style={{ flex: 1 }}>
              {C.thTeam}
            </Txt>
            {head(C.thP, 30)}
            {head(C.thW, 22)}
            {head(C.thD, 22)}
            {head(C.thL, 22)}
            {head(C.thGd, 34)}
            {head(C.thPts, 34)}
          </View>
          {rows.map((s) => {
            const team = table.teams.find((t) => t.teamId === s.teamId);
            const mine = s.teamId === mineId;
            const zone = leagueZone(s.rank, rows.length, table.tier, bottomTier);
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
                <Txt v="sm" bold style={{ width: 18 }}>
                  {String(s.rank)}
                </Txt>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <TeamLogo logo={team?.logo} name={team?.name ?? C.tbd} size={24} decorative />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt v="sm" bold={mine} tone={mine ? 'accent' : 'ink'}>
                      {team?.name ?? C.tbd}
                    </Txt>
                    <Txt v="xs" tone="muted">
                      {`${C.teamOwnerLabel} ${team?.owner ?? C.tbd}${s.forfeits ? ` · ${L.forfeitsTag({ n: s.forfeits })}` : ''}`}
                    </Txt>
                  </View>
                </View>
                {cell(s.p, 30)}
                {cell(s.w, 22)}
                {cell(s.d, 22)}
                {cell(s.l, 22)}
                {cell(gd > 0 ? `+${gd}` : gd, 34)}
                {cell(s.pts, 34, true)}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Txt v="xs" tone="muted">
        {[table.tier > 1 ? L.zoneUp : null, table.tier < bottomTier ? L.zoneDown : null, L.ruleMove]
          .filter(Boolean)
          .join(' · ')}
      </Txt>
    </Card>
  );
}

function Rounds({
  table,
  round,
  setRound,
  mineId,
  onopen,
}: {
  table: LeagueTableResponse;
  round: number;
  setRound: (n: number) => void;
  mineId: string | null;
  onopen: (m: LeagueMatch) => void;
}) {
  const c = useColors();
  const day = leagueRound(table, round);
  const name = (id: string) => table.teams.find((t) => t.teamId === id)?.name ?? C.tbd;
  return (
    <Card gap={8} testID="league-rounds">
      <Txt v="h3" bold accessibilityRole="header">
        {L.roundsTitle}
      </Txt>
      <Chips
        items={Array.from({ length: LEAGUE_ROUNDS }, (_, i) => i + 1)}
        on={(n) => n === round}
        label={(n) => L.roundName({ n })}
        keyOf={String}
        pick={setRound}
        testID="league-round"
      />
      {day.matches.map((m) => {
        const mine = m.homeTeamId === mineId || m.awayTeamId === mineId;
        const open = m.played && !m.forfeit;
        const mid = (
          <View style={{ alignItems: 'center', minWidth: 64 }}>
            <Txt bold num style={{ fontFamily: DISPLAY[700] }}>
              {leagueMatchMid(m)}
            </Txt>
            {m.forfeit ? (
              <Txt v="xs" tone="warn">
                {L.forfeitScore}
              </Txt>
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
      {day.resting.map((t) => (
        <Txt key={t.teamId} v="sm" tone="muted">
          {L.restTeam({ team: t.name })}
        </Txt>
      ))}
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
  setRound,
  onopen,
}: {
  season: number;
  pick: LeaguePick;
  bottomTier: number;
  mineId: string | null;
  round: number;
  setRound: (n: number) => void;
  onopen: (m: LeagueMatch, table: LeagueTableResponse) => void;
}) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [table, setTable] = useState<LeagueTableResponse | null>(null);
  const load = async () => {
    setStatus('loading');
    const r = await fetchLeagueTable(season, pick.tier, pick.league);
    if (r.ok) setTable(r.data);
    setStatus(r.ok ? 'ready' : 'error');
  };
  useEffect(() => {
    setTable(null);
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
  return (
    <>
      <Standings table={table} bottomTier={bottomTier} mineId={mineId} />
      <Rounds
        table={table}
        round={round}
        setRound={setRound}
        mineId={mineId}
        onopen={(m) => onopen(m, table)}
      />
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
      <Btn block onPress={back} testID="league-match-back">
        {L.detailBack}
      </Btn>
    </Card>
  );
}
