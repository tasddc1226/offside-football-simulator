import { RADIUS } from '@offside/app-core/design-tokens';
import { LoginButtons } from './LoginButtons';
import CupBracket from './CupBracket';
import { scrollToView } from '../../ui/scroll';
import CupMatchStatus from './CupMatchStatus';
import { TeamLive } from './TeamLive';
import { cupLiveMatch, firstLive } from '@offside/app-core/teamLive';
// T-11-145 오프사이드 컵 화면(구단주 화면의 컵 배너로 연다, 웹 Cup.svelte) — 내 상태 · 토너먼트 · 조별 순위 · 일정 · 보상 · 규칙 ·
// 경기 상세.
// 경기 상세는 팀 경기 결과(TeamResult)와 같은 모양이지만 공개 시점(홈 기준)이라 레이팅·다시 하기 줄은 없다.
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { isMember } from '@offside/app-core/account';
import {
  fetchCupMatch,
  type CupMatch,
  type CupMatchResponse,
  type CupResponse,
} from '@offside/app-core/api/cup';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { cupBeforeDraw } from '@offside/app-core/cupHome';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { cupRewardText } from '@offside/app-core/cupReward';
import { cupAppText as A } from '@offside/app-core/i18n/ko/cupApp';
import { teamMatchText as TM } from '@offside/app-core/i18n/ko/teamMatch';
import { CUP_KO_ROUNDS, CUP_STAGES, cupPredictionCap, type CupRound } from '@offside/contracts/cup';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { refreshAccount } from '../../game/host';
import { go } from '../../game/nav';
import { accountCache, appState } from '../../store';
import { hofStart } from '@offside/app-core/state';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Pill, Press, Screen, Skeleton, Topbar, Txt, scrollTo } from '../../ui';
import { dayTimeText, roundLabel, stageLabel, timeText } from './cupText';
import { CupCard, useCup, type CupState } from './TeamCup';

import { cupFolds, rememberCupFolds, type CupScheduleTab } from '@offside/app-core/cupFolds';
import { divisionCapLabel, divisionLabel } from '@offside/app-core/cupDivision';
import { CupPrediction, PredictionIntro, usePredictions } from './CupPrediction';
import type { CupPredictionContext } from '@offside/app-core/cupPredictions';

const KO_ROUNDS: readonly CupRound[] = CUP_KO_ROUNDS;

/** T-11-410 OVR 구간 탭(구간 대회만). 고르면 그 구간 대회를 다시 부른다. */
function DivisionTabs({ state }: { state: CupState }) {
  const c = useColors();
  const list = state.cup?.divisions;
  if (!list) return null;
  const at = state.cup!.cup.id;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={L.divisionTabs}
      style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}
    >
      {list.map((d) => {
        const on = d.id === at;
        return (
          <Press
            key={d.id}
            testID={`cup-division-${d.division}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => (on ? undefined : state.pick(d.id))}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 64,
              gap: 2,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: RADIUS.md,
              borderWidth: on ? 2 : 1,
              borderColor: on ? c.accent : c.line,
              backgroundColor: c.surface,
            }}
          >
            <Txt bold numberOfLines={1}>
              {divisionLabel(d.division)}
            </Txt>
            <Txt v="xs" tone="muted">
              {divisionCapLabel(d)}
            </Txt>
            <Txt v="xs" tone={d.id === state.myDivision ? 'good' : 'muted'}>
              {d.id === state.myDivision ? L.divisionMine : L.divisionEntries({ n: d.entries })}
            </Txt>
          </Press>
        );
      })}
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Txt v="sm" tone="muted">
        ·
      </Txt>
      <Txt v="sm" style={{ flex: 1 }}>
        {children}
      </Txt>
    </View>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Txt v="sm" tone="muted">
        {k}
      </Txt>
      <Txt v="sm" bold style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </Txt>
    </View>
  );
}

function ScheduleTab({
  label,
  active,
  onPress,
  chip = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  chip?: boolean;
}) {
  const c = useColors();
  return (
    <Press
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={{
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: chip ? 10 : 0,
        borderBottomWidth: chip ? 1 : 3,
        borderWidth: chip ? 1 : 0,
        borderColor: active ? c.accent : chip ? c.line : 'transparent',
        borderRadius: chip ? 10 : 0,
      }}
    >
      <Txt v="sm" bold={active} tone={active ? 'accent' : 'muted'}>
        {label}
      </Txt>
    </Press>
  );
}

/** 접었다 펴는 제목 줄. */
function Fold({
  title,
  aside,
  open,
  toggle,
  label,
  testID,
}: {
  title: string;
  aside?: string | undefined;
  open: boolean;
  toggle: () => void;
  label: string;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Press
      scale={0.985}
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      onPress={toggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      <Txt bold style={{ flex: 1 }}>
        {title}
      </Txt>
      {aside ? (
        <Txt v="xs" tone="muted">
          {aside}
        </Txt>
      ) : null}
      <Txt tone="muted">{open ? '▾' : '▸'}</Txt>
    </Press>
  );
}

function Standings({
  cup,
  standings,
  mineId,
  onteam,
}: {
  cup: CupResponse;
  standings: CupResponse['groups'][number]['standings'];
  mineId: string | null;
  onteam: (id: string) => void;
}) {
  const c = useColors();
  const num = (w: number) => ({ width: w, textAlign: 'right' as const });
  const head = (text: string, w: number) => (
    <Txt v="xs" tone="muted" style={num(w)}>
      {text}
    </Txt>
  );
  return (
    <View style={{ gap: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={L.secGroups}>
        <View style={{ gap: 2, width: 420 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}
          >
            <View style={{ width: 18 }} />
            <Txt v="xs" tone="muted" style={{ flex: 1 }}>
              {L.thTeam}
            </Txt>
            {head(L.thP, 30)}
            {head(L.thW, 22)}
            {head(L.thD, 22)}
            {head(L.thL, 22)}
            {head(L.thGd, 34)}
            {head(L.thPts, 34)}
          </View>
          {[...standings]
            .sort((a, b) => a.rank - b.rank)
            .map((s) => {
              const team = cup.teams.find((t) => t.teamId === s.teamId);
              const mine = s.teamId === mineId;
              const up = s.rank <= 2;
              const cell = (value: string | number, w: number, bold = false) => (
                <Txt v="sm" bold={bold || mine} num style={num(w)}>
                  {String(value)}
                </Txt>
              );
              const gd = s.gf - s.ga;
              return (
                <Press
                  onPress={() => onteam(s.teamId)}
                  accessibilityHint={L.lineupOpen}
                  key={s.teamId}
                  testID={`cup-standing-${s.teamId}`}
                  accessible
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingVertical: 6,
                    paddingHorizontal: 6,
                    borderRadius: RADIUS.sm,
                    backgroundColor: up ? alpha(c.good, 0.14) : 'transparent',
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
                    <TeamLogo logo={team?.logo} name={team?.name ?? L.tbd} size={24} decorative />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt v="sm" bold={mine} tone={mine ? 'accent' : 'ink'}>
                        {team?.name ?? L.tbd}
                      </Txt>
                      <Txt v="xs" tone="muted">
                        {L.teamOwnerLabel} {team?.owner ?? L.tbd}
                      </Txt>
                    </View>
                  </View>
                  {cell(s.p, 30)}
                  {cell(s.w, 22)}
                  {cell(s.d, 22)}
                  {cell(s.l, 22)}
                  {cell(gd > 0 ? `+${gd}` : gd, 34)}
                  {cell(s.pts, 34, true)}
                </Press>
              );
            })}
        </View>
      </ScrollView>
      <Txt v="xs" tone="muted">
        {L.standingsScroll}
      </Txt>
      <Txt v="xs" tone="muted">
        {L.standingsRule}
      </Txt>
    </View>
  );
}

/** 경기 한 줄. 치른 경기는 눌러 상세로. */
function MatchLine({
  cup,
  m,
  mineId,
  open,
  prediction,
}: {
  prediction: CupPredictionContext;
  cup: CupResponse;
  m: CupMatch;
  mineId: string | null;
  open: (m: CupMatch) => void;
}) {
  const c = useColors();
  const home = cup.teams.find((t) => t.teamId === m.homeTeamId);
  const away = cup.teams.find((t) => t.teamId === m.awayTeamId);
  const mine = !!mineId && (m.homeTeamId === mineId || m.awayTeamId === mineId);
  // T-11-290 팀(로고·이름)을 누르면 팀 프로필, 그 아래 구단주 이름을 누르면 구단주 프로필(승부예측 줄에서 상대를 살핀다).
  const side = (t: typeof home, id: string | null, right: boolean) => {
    const name = (
      <Txt
        v="sm"
        numberOfLines={1}
        bold={m.winnerTeamId === id && !!id}
        tone={id && id === mineId ? 'accent' : 'ink'}
        style={{ flexShrink: 1, textAlign: right ? 'right' : 'left' }}
      >
        {t?.name ?? L.tbd}
      </Txt>
    );
    return (
      <View style={{ flex: 1, minWidth: 0, alignItems: right ? 'flex-end' : 'flex-start', gap: 2 }}>
        {t && id ? (
          <>
            <Press
              onPress={() => prediction.team(id)}
              accessibilityLabel={L.teamProfileOpen({ team: t.name })}
              testID={`cup-match-team-${m.id}-${right ? 'home' : 'away'}`}
              style={{
                maxWidth: '100%',
                flexDirection: right ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 2,
              }}
            >
              <TeamLogo logo={t.logo} name={t.name} size={24} decorative />
              {name}
            </Press>
            <Press
              onPress={() => prediction.team(id, true)}
              accessibilityLabel={L.ownerProfileOpen({ owner: t.owner })}
              testID={`cup-match-owner-${m.id}-${right ? 'home' : 'away'}`}
              style={{ maxWidth: '100%', minHeight: 20, justifyContent: 'center' }}
            >
              <Txt
                v="xs"
                tone="muted"
                numberOfLines={1}
                style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}
              >
                {t.owner}
              </Txt>
            </Press>
          </>
        ) : (
          name
        )}
      </View>
    );
  };
  const notes = [
    m.round.startsWith('g') ? dayTimeText(m.at) : null,
    m.pens ? L.pens({ home: m.pens.home, away: m.pens.away }) : null,
    m.forfeit ? L.forfeit : null,
  ].filter(Boolean);
  const body = (
    <>
      <View style={{ alignItems: 'center', marginBottom: 4 }}>
        <CupMatchStatus m={m} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {side(home, m.homeTeamId, true)}
        <Txt bold num style={{ minWidth: 44, textAlign: 'center' }}>
          {m.played ? `${m.homeGoals ?? 0} : ${m.awayGoals ?? 0}` : 'vs'}
        </Txt>
        {side(away, m.awayTeamId, false)}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Txt v="xs" tone="muted">
          {notes.join(' · ')}
        </Txt>
        {mine ? <Pill tone="good">{L.mineTag}</Pill> : null}
      </View>
      {m.odds ? <MatchOdds m={m} home={home?.name ?? L.tbd} away={away?.name ?? L.tbd} /> : null}
    </>
  );
  const style = {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.line,
  } as const;
  const row =
    !m.played || m.forfeit ? (
      <View style={style} testID={`cup-match-${m.id}`}>
        {body}
      </View>
    ) : (
      <Press
        scale={0.985}
        testID={`cup-match-${m.id}`}
        accessibilityLabel={L.matchAria({
          home: home?.name ?? L.tbd,
          away: away?.name ?? L.tbd,
          hg: m.homeGoals ?? 0,
          ag: m.awayGoals ?? 0,
        })}
        onPress={() => open(m)}
        style={style}
      >
        {body}
      </Press>
    );
  return (
    <View>
      {row}
      <CupPrediction m={m} prediction={prediction} />
    </View>
  );
}

/** T-11-407 명단이 잠긴 경기(1시간 전부터)의 홈 · 무 · 원정 예상 막대. 끝난 경기는 '경기 전 예상'으로 남긴다. */
function MatchOdds({ m, home, away }: { m: CupMatch; home: string; away: string }) {
  const c = useColors();
  const o = m.odds!;
  const label = m.played ? L.matchOddsBefore : L.matchOddsLabel;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={L.matchOddsAria({ label, home, away, h: o.home, d: o.draw, a: o.away })}
      testID={`cup-match-odds-${m.id}`}
      style={{ gap: 3, marginTop: 4 }}
    >
      <View
        style={{ flexDirection: 'row', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' }}
      >
        <View style={{ flex: Math.max(o.home, 1), backgroundColor: c.accent }} />
        <View style={{ flex: Math.max(o.draw, 1), backgroundColor: c.line }} />
        <View style={{ flex: Math.max(o.away, 1), backgroundColor: c.muted }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt v="xs" bold num>{`${o.home}%`}</Txt>
        <Txt v="xs" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
          {`${label} · ${L.matchOddsDraw({ n: o.draw })}`}
        </Txt>
        <Txt v="xs" bold num>{`${o.away}%`}</Txt>
      </View>
    </View>
  );
}

/** 컵 경기 상세(득점 기록). 누구나 보는 화면이라 홈·원정 순서 그대로 보여 준다. */
function CupMatchDetail({
  cupId,
  matchId,
  mineId,
  back,
}: {
  cupId: string;
  matchId: string;
  mineId: string | null;
  back: () => void;
}) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<CupMatchResponse | null>(null);
  const [live, setLive] = useState(false);
  const load = async () => {
    setStatus('loading');
    const r = await fetchCupMatch(cupId, matchId);
    if (r.ok) {
      setData(r.data);
      // T-11-214 이번 실행에서 처음 여는 경기는 친선전처럼 문자중계부터 보여 준다(결과 데이터는 그대로).
      setLive(firstLive(matchId));
    }
    setStatus(r.ok ? 'ready' : 'error');
  };
  useEffect(() => {
    void load();
    // 경기가 바뀔 때만.
  }, [cupId, matchId]);
  const m = data?.match;
  const info = data?.cup;
  const goalStyle = { fontFamily: DISPLAY[700], fontSize: rem(2.5), lineHeight: rem(2.5) } as const;
  const side = (s: NonNullable<typeof m>['home'], away: boolean) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: away ? 'flex-end' : 'flex-start' }}>
      <TeamLogo logo={s.logo} name={s.name} size={40} decorative />
      <Txt bold style={{ textAlign: away ? 'right' : 'left' }}>
        {s.name}
      </Txt>
      <Txt tone="muted" v="xs" style={{ textAlign: away ? 'right' : 'left' }}>
        {`${s.owner} · OVR ${s.ovr}`}
      </Txt>
    </View>
  );
  let verdict: string | null = null;
  if (m && info) {
    const pens = info.pens;
    if (pens && m.home.goals === m.away.goals)
      verdict = L.penWinner({ team: pens.home > pens.away ? m.home.name : m.away.name });
    else if (m.home.goals === m.away.goals) verdict = L.draw;
    else verdict = L.winner({ team: m.home.goals > m.away.goals ? m.home.name : m.away.name });
  }
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
    <Card gap={14} testID="cup-match-detail">
      <View>
        <Txt v="eyebrow">Full time</Txt>
        <Txt v="h1" accessibilityRole="header">
          {info ? L.detailRound({ round: roundLabel(info.round), group: info.group }) : L.title}
        </Txt>
      </View>
      <LoadState status={status} failText={L.detailFail} retry={() => void load()}>
        {m && info ? (
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
            <View style={{ gap: 2 }}>
              {verdict ? <Txt bold>{verdict}</Txt> : null}
              {info.pens ? (
                <Txt v="sm" tone="muted">
                  {L.pens({ home: info.pens.home, away: info.pens.away })}
                </Txt>
              ) : null}
              {info.forfeit ? (
                <Txt v="sm" tone="warn">
                  {L.forfeitNote}
                </Txt>
              ) : null}
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
                          {L.assist({ name: e.assist })}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Txt tone="muted">{L.noGoals}</Txt>
            )}
            <Txt tone="muted" v="sm">
              {kstMonthDayTime(m.createdAt)}
            </Txt>
          </>
        ) : null}
      </LoadState>
      {m ? (
        <Btn block onPress={() => setLive(true)} testID="cup-replay">
          {TM.replay}
        </Btn>
      ) : null}
      <Btn block onPress={back} testID="cup-match-back">
        {L.detailBack}
      </Btn>
    </Card>
  );
}

/** 추첨 전 신청한 팀(신청 순, T-11-160). */
function Entrants({
  teams,
  mineId,
  onteam,
}: {
  teams: CupResponse['teams'];
  mineId: string | null;
  onteam: (id: string) => void;
}) {
  const c = useColors();
  return (
    <Card gap={6} testID="cup-entrants">
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Txt v="h2" accessibilityRole="header">
          {L.secEntrants}
        </Txt>
        <Txt v="sm" tone="muted">
          {L.teamsCount({ n: teams.length })}
        </Txt>
      </View>
      <Txt v="xs" tone="muted">
        {L.entrantsNote}
      </Txt>
      {teams.map((t, i) => {
        const mine = t.teamId === mineId;
        return (
          <Press
            onPress={() => onteam(t.teamId)}
            accessibilityHint={L.lineupOpen}
            key={t.teamId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Txt v="xs" tone="muted" style={{ width: 20, textAlign: 'right' }}>
              {String(i + 1)}
            </Txt>
            <TeamLogo logo={t.logo} name={t.name} size={28} decorative />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="sm" bold tone={mine ? 'accent' : 'ink'} numberOfLines={1}>
                {t.name}
              </Txt>
              <Txt v="xs" tone="muted" numberOfLines={1}>
                {t.owner}
              </Txt>
            </View>
            {mine ? <Pill tone="good">{L.mineTeam}</Pill> : null}
            <Txt v="sm">{`OVR ${t.ovr}`}</Txt>
          </Press>
        );
      })}
    </Card>
  );
}

function CupBody({
  state,
  linked,
  accountId,
}: {
  state: CupState;
  linked: boolean;
  accountId: string | null;
}) {
  const c = useColors();
  const { cup: data, me } = state;
  const {
    state: predictions,
    now,
    controller,
  } = usePredictions(data?.cup.id, accountId, data?.matches);
  // T-11-290 owner면 그 팀 구단주의 프로필(승부예측 줄의 구단주 이름). 뒤로 가면 팀 프로필.
  function openTeam(id: string, owner = false) {
    if (data)
      rememberCupFolds(data.cup.id, accountId, {
        groups: Object.fromEntries(data.groups.map((g) => [g.no, groupOpen(g.no)])),
        rounds: Object.fromEntries(KO_ROUNDS.map((r) => [r, roundOpen(r)])),
        schedule: { tab: scheduleTab, group: selectedGroup, bracketList },
        bracket: { match: bracketMatch?.id ?? null, ...bracketView.current },
      });
    appState.hof = {
      ...hofStart(),
      tab: 'teams',
      team: id,
      season: data?.cup.season ?? null,
      owner,
    };
    go('hof');
  }
  const prediction: CupPredictionContext = {
    state: predictions,
    now,
    linked,
    pick: (id, choice) => void controller.pick(id, choice),
    team: openTeam,
  };
  const fixtures = useRef<View>(null);
  const [bracketListChoice, setBracketList] = useState<boolean | null>(null);
  const [scheduleChoice, setScheduleChoice] = useState<CupScheduleTab | null>(null);
  const [groupChoice, setGroupChoice] = useState<number | null>(null);
  // T-11-406 팀 프로필에서 돌아오면 대진표에서 골랐던 경기 · 보던 자리를 다시 연다.
  const [bracketMatch, setBracketMatch] = useState<CupMatch | null>(null);
  const bracketView = useRef({ column: 0, y: 0 });
  const bracketRestored = useRef(false);
  useEffect(() => {
    if (!data || bracketRestored.current) return;
    bracketRestored.current = true;
    const id = cupFolds(data.cup.id, accountId)?.bracket?.match;
    const m = id ? data.matches.find((x) => x.id === id) : undefined;
    if (m) setBracketMatch(m);
  }, [data, accountId]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean> | null>(null);
  const [openRounds, setOpenRounds] = useState<Record<string, boolean> | null>(null);
  // T-11-392 불러오는 동안은 대회 현황 · 대진 카드 모양 뼈대, 실패는 카드 안 다시 시도.
  if (!data)
    return state.status === 'error' ? (
      <Card gap={10}>
        <LoadState status={state.status} failText={L.loadFail} retry={() => void state.reload()}>
          {null}
        </LoadState>
      </Card>
    ) : (
      <View style={{ gap: 12 }}>
        <Skeleton height={120} />
        <Skeleton height={260} />
      </View>
    );
  const mineId = me?.entry && me.entry.status !== 'withdrawn' ? me.entry.teamId : null;
  if (matchId)
    return (
      <CupMatchDetail
        cupId={data.cup.id}
        matchId={matchId}
        mineId={mineId}
        back={() => setMatchId(null)}
      />
    );

  const mineGroup = mineId
    ? (data.groups.find((g) => g.standings.some((s) => s.teamId === mineId))?.no ?? null)
    : null;
  const groups = [...data.groups].sort(
    (a, b) => Number(b.no === mineGroup) - Number(a.no === mineGroup),
  );
  const rounds = data.cup.rounds;
  const first = rounds[0];
  const nextRound = data.matches.find((m) => !m.played)?.round;
  const folds = cupFolds(data.cup.id, accountId);
  const groupDefaults = folds?.groups ?? Object.fromEntries(groups.map((g) => [g.no, true]));
  const roundDefaults = folds?.rounds ?? {
    [nextRound && KO_ROUNDS.includes(nextRound) ? nextRound : 'f']: true,
  };
  const groupOpen = (no: number) => (openGroups ?? groupDefaults)[no] ?? false;
  const roundOpen = (r: CupRound) => (openRounds ?? roundDefaults)[r] ?? false;
  const koMatches = (r: CupRound) =>
    data.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
  const koRounds = KO_ROUNDS.filter((r) => koMatches(r).length);
  const scheduleTab =
    scheduleChoice ?? folds?.schedule?.tab ?? (koRounds.length ? 'knockout' : 'groups');
  const selectedGroup = groupChoice ?? folds?.schedule?.group ?? mineGroup ?? groups[0]?.no ?? 1;
  const bracketList = bracketListChoice ?? folds?.schedule?.bracketList ?? false;
  const open = (m: CupMatch) => setMatchId(m.id);
  const early = cupBeforeDraw(data.phase);
  const closeInclusive = new Date(Date.parse(data.cup.closesAt) - 60_000).toISOString();

  return (
    <>
      {!linked && accountId === null && accountCache.value && accountCache.value !== 'error' ? (
        <Card gap={10} testID="cup-login">
          <Txt v="h2">{L.predictionLoginTitle}</Txt>
          <Txt v="sm" tone="muted" testID="cup-login-note">
            {L.loginCardNote}
          </Txt>
          {/* T-11-443 iOS에서는 Apple 로그인도 함께(다른 로그인 카드와 같은 LoginButtons). */}
          <LoginButtons back={{ cup: true }} />
        </Card>
      ) : null}
      <CupCard
        state={state}
        onSchedule={() => {
          setScheduleChoice(koRounds.length ? 'knockout' : 'groups');
          requestAnimationFrame(() => scrollToView(fixtures.current, true));
        }}
      />
      <PredictionIntro
        prediction={prediction}
        retry={() => void controller.load(data.cup.id, linked)}
        cap={cupPredictionCap(data.cup.edition)}
      />
      {early && data.teams.length ? (
        <Entrants teams={data.teams} mineId={mineId} onteam={openTeam} />
      ) : null}

      <Card gap={8} testID="cup-rules">
        <Txt v="h2" accessibilityRole="header">
          {L.secRules}
        </Txt>
        <Bullet>{L.rulePlay({ min: data.cup.minFilled, cap: data.cup.capacity })}</Bullet>
        <Bullet>{L.ruleGroup}</Bullet>
        <Bullet>{L.rulePoints}</Bullet>
        <Bullet>{L.ruleKnockout}</Bullet>
        {first ? <Bullet>{L.ruleDaily({ time: timeText(first.at) })}</Bullet> : null}
        {first ? <Bullet>{L.ruleLock({ time: timeText(first.lockAt) })}</Bullet> : null}
        <Bullet>{L.ruleForfeit}</Bullet>
        {data.divisions ? <Bullet>{L.ruleDivisions}</Bullet> : null}
        {data.divisions ? <Bullet>{L.ruleDivisionMove}</Bullet> : null}
      </Card>

      <Card gap={6} testID="cup-schedule">
        <Txt v="h2" accessibilityRole="header">
          {L.scheduleEntryDraw}
        </Txt>
        <Kv
          k={L.schedEntry}
          v={`${dayTimeText(data.cup.opensAt)} ~ ${dayTimeText(closeInclusive)}`}
        />
        <Kv k={L.schedDraw} v={dayTimeText(data.cup.drawAt)} />
      </Card>

      <Card gap={6} testID="cup-rewards">
        <Txt v="h2" accessibilityRole="header">
          {L.secRewards}
        </Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt v="xs" tone="muted">
            {L.rewardStage}
          </Txt>
          <Txt v="xs" tone="muted">
            {L.rewardItem}
          </Txt>
        </View>
        {CUP_STAGES.map((s) => (
          <Kv key={s} k={stageLabel(s)} v={cupRewardText(state.cup?.cup.edition ?? 0, s)} />
        ))}
        <Txt v="xs" tone="muted">
          {L.rewardNote}
        </Txt>
      </Card>

      <View ref={fixtures} collapsable={false}>
        <Card gap={10} testID="cup-fixtures">
          <Txt v="h2" accessibilityRole="header">
            {L.scheduleMatches}
          </Txt>
          <Txt v="xs" tone="muted">
            {L.matchOddsPending}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {(
              [
                ['groups', L.secGroups],
                ['knockout', L.secBracket],
              ] as const
            ).map(([tab, label]) => (
              <ScheduleTab
                key={tab}
                label={label}
                active={scheduleTab === tab}
                onPress={() => setScheduleChoice(tab)}
              />
            ))}
          </View>
          <View
            style={scheduleTab !== 'groups' ? { display: 'none' } : undefined}
            testID="cup-groups"
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
            >
              {groups.map((g) => (
                <ScheduleTab
                  key={g.no}
                  chip
                  label={`${L.groupName({ no: g.no })}${g.no === mineGroup ? ` · ${L.myGroup}` : ''}`}
                  active={selectedGroup === g.no}
                  onPress={() => setGroupChoice(g.no)}
                />
              ))}
            </ScrollView>
            {data.groups.length ? (
              <>
                <Txt v="xs" tone="muted">
                  {L.advanceNote}
                </Txt>
                {groups.map((g) => {
                  const name = L.groupName({ no: g.no });
                  const isOpen = groupOpen(g.no);
                  return (
                    <View
                      key={g.no}
                      style={selectedGroup !== g.no ? { display: 'none' } : undefined}
                    >
                      <Fold
                        title={g.no === mineGroup ? `${name} · ${L.myGroup}` : name}
                        aside={L.teamsCount({ n: g.standings.length })}
                        open={isOpen}
                        label={A.groupToggle({ name })}
                        testID={`cup-group-${g.no}`}
                        toggle={() =>
                          setOpenGroups({
                            ...(openGroups ?? groupDefaults),
                            [g.no]: !isOpen,
                          })
                        }
                      />
                      {isOpen ? (
                        <View style={{ gap: 6 }}>
                          <Standings
                            cup={data}
                            standings={g.standings}
                            mineId={mineId}
                            onteam={openTeam}
                          />
                          {data.matches
                            .filter((m) => m.group === g.no && !KO_ROUNDS.includes(m.round))
                            .sort((a, b) => a.at.localeCompare(b.at))
                            .map((m) => (
                              <MatchLine
                                key={m.id}
                                cup={data}
                                m={m}
                                mineId={mineId}
                                open={open}
                                prediction={prediction}
                              />
                            ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : (
              <Txt v="sm" tone="muted">
                {L.noGroups}
              </Txt>
            )}
          </View>
          <View
            style={scheduleTab !== 'knockout' ? { display: 'none' } : undefined}
            testID="cup-bracket"
          >
            {koRounds.length ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 4,
                  padding: 4,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: RADIUS.md,
                  backgroundColor: c.bg,
                  marginBottom: 10,
                }}
              >
                {[false, true].map((list) => (
                  <Press
                    key={String(list)}
                    onPress={() => setBracketList(list)}
                    accessibilityState={{ selected: bracketList === list }}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: 8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: RADIUS.sm,
                      borderWidth: 1,
                      borderColor: bracketList === list ? c.line : 'transparent',
                      backgroundColor: bracketList === list ? c.surface : 'transparent',
                    }}
                  >
                    <Txt v="sm" bold tone={bracketList === list ? 'ink' : 'muted'}>
                      {list ? L.bracketList : L.bracketView}
                    </Txt>
                  </Press>
                ))}
              </View>
            ) : null}
            {koRounds.length ? (
              <View style={bracketList ? { display: 'none' } : undefined}>
                <View style={bracketMatch ? { display: 'none' } : undefined}>
                  <CupBracket
                    cup={data}
                    mineId={mineId}
                    now={now}
                    onselect={setBracketMatch}
                    start={folds?.bracket ?? null}
                    view={bracketView}
                  />
                </View>
                {bracketMatch ? (
                  <Btn onPress={() => setBracketMatch(null)}>{L.bracketView}</Btn>
                ) : null}
                {bracketMatch ? (
                  <MatchLine
                    cup={data}
                    m={bracketMatch}
                    mineId={mineId}
                    open={open}
                    prediction={prediction}
                  />
                ) : null}
              </View>
            ) : null}
            {koRounds.length ? (
              bracketList ? (
                koRounds.map((r) => {
                  const isOpen = roundOpen(r);
                  const list = koMatches(r);
                  return (
                    <View key={r}>
                      <Fold
                        title={roundLabel(r)}
                        aside={list[0] ? dayTimeText(list[0].at) : undefined}
                        open={isOpen}
                        label={A.roundToggle({ name: roundLabel(r) })}
                        testID={`cup-round-${r}`}
                        toggle={() =>
                          setOpenRounds({
                            ...(openRounds ?? roundDefaults),
                            [r]: !isOpen,
                          })
                        }
                      />
                      {isOpen
                        ? list.map((m) => (
                            <MatchLine
                              key={m.id}
                              cup={data}
                              m={m}
                              mineId={mineId}
                              open={open}
                              prediction={prediction}
                            />
                          ))
                        : null}
                    </View>
                  );
                })
              ) : null
            ) : (
              <Txt v="sm" tone="muted">
                {L.noBracket}
              </Txt>
            )}
          </View>
        </Card>
      </View>
    </>
  );
}

export default function Cup() {
  const cache = useSnapshot(accountCache);
  const acct = cache.value;
  const linked = !!acct && acct !== 'error' && isMember(acct);
  // 구단주 화면을 거치지 않고 들어와도(되돌아가기 등) 로그인 상태를 알아야 내 상태를 묻는다.
  useEffect(() => {
    if (accountCache.value === undefined) void refreshAccount();
  }, []);
  const state = useCup(true, linked);
  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Offside Cup</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {state.cup
            ? L.fullTitle({ n: state.cup.cup.edition, d: divisionLabel(state.cup.cup.division) })
            : L.title}
        </Txt>
      </View>
      <DivisionTabs state={state} />
      <CupBody
        key={`${state.cup?.cup.id ?? 'loading'}:${linked ? acct.id : 'guest'}`}
        state={state}
        linked={linked}
        accountId={linked ? acct.id : null}
      />
    </Screen>
  );
}
