// T-11-145 오프사이드 컵 화면(구단주 화면의 컵 배너로 연다, 웹 Cup.svelte) — 내 상태 · 토너먼트 · 조별 순위 · 일정 · 보상 · 규칙 ·
// 경기 상세.
// 경기 상세는 팀 경기 결과(TeamResult)와 같은 모양이지만 공개 시점(홈 기준)이라 레이팅·다시 하기 줄은 없다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { isMember } from '@offside/app-core/account';
import {
  fetchCupMatch,
  type CupMatch,
  type CupMatchResponse,
  type CupResponse,
} from '@offside/app-core/api/cup';
import { kstMonthDayTime } from '@offside/app-core/boardText';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { cupAppText as A } from '@offside/app-core/i18n/ko/cupApp';
import { teamMatchText as TM } from '@offside/app-core/i18n/ko/teamMatch';
import { CUP_REWARDS, CUP_STAGES, type CupRound } from '@offside/contracts/cup';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { refreshAccount } from '../../game/host';
import { go } from '../../game/nav';
import { accountCache } from '../../store';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { BackBar, Btn, Card, Pill, Press, Screen, Topbar, Txt } from '../../ui';
import { dayTimeText, roundLabel, stageLabel, timeText } from './cupText';
import { CupCard, teamNameIn, useCup, type CupState } from './TeamCup';

const KO_ROUNDS: CupRound[] = ['r32', 'r16', 'qf', 'sf', 'f'];

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
}: {
  cup: CupResponse;
  standings: CupResponse['groups'][number]['standings'];
  mineId: string | null;
}) {
  const c = useColors();
  const num = (w: number) => ({ width: w, textAlign: 'right' as const });
  const head = (text: string, w: number) => (
    <Txt v="xs" tone="muted" style={num(w)}>
      {text}
    </Txt>
  );
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
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
          const mine = s.teamId === mineId;
          const up = s.rank <= 2;
          const cell = (value: string | number, w: number, bold = false) => (
            <Txt v="sm" bold={bold || mine} num style={num(w)}>
              {String(value)}
            </Txt>
          );
          const gd = s.gf - s.ga;
          return (
            <View
              key={s.teamId}
              testID={`cup-standing-${s.teamId}`}
              accessible
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 6,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: up ? alpha(c.good, 0.14) : 'transparent',
              }}
            >
              <Txt v="sm" bold style={{ width: 18 }}>
                {String(s.rank)}
              </Txt>
              <Txt
                v="sm"
                bold={mine}
                tone={mine ? 'accent' : 'ink'}
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {teamNameIn(cup, s.teamId)}
              </Txt>
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
  );
}

/** 경기 한 줄. 치른 경기는 눌러 상세로. */
function MatchLine({
  cup,
  m,
  mineId,
  open,
}: {
  cup: CupResponse;
  m: CupMatch;
  mineId: string | null;
  open: (m: CupMatch) => void;
}) {
  const c = useColors();
  const home = cup.teams.find((t) => t.teamId === m.homeTeamId);
  const away = cup.teams.find((t) => t.teamId === m.awayTeamId);
  const mine = !!mineId && (m.homeTeamId === mineId || m.awayTeamId === mineId);
  const side = (t: typeof home, id: string | null, right: boolean) => (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: right ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {t ? <TeamLogo logo={t.logo} name={t.name} size={24} decorative /> : null}
      <Txt
        v="sm"
        numberOfLines={1}
        bold={m.winnerTeamId === id && !!id}
        tone={id && id === mineId ? 'accent' : 'ink'}
        style={{ flex: 1, textAlign: right ? 'right' : 'left' }}
      >
        {t?.name ?? L.tbd}
      </Txt>
    </View>
  );
  const notes = [
    dayTimeText(m.at),
    m.pens ? L.pens({ home: m.pens.home, away: m.pens.away }) : null,
    m.forfeit ? L.forfeit : null,
  ].filter(Boolean);
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {side(home, m.homeTeamId, true)}
        <Txt bold num style={{ minWidth: 44, textAlign: 'center' }}>
          {m.played ? `${m.homeGoals ?? 0} : ${m.awayGoals ?? 0}` : 'vs'}
        </Txt>
        {side(away, m.awayTeamId, false)}
      </View>
      <View
        style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
      >
        <Txt v="xs" tone="muted">
          {notes.join(' · ')}
        </Txt>
        {mine ? <Pill tone="good">{L.mineTag}</Pill> : null}
      </View>
    </>
  );
  const style = {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.line,
  } as const;
  if (!m.played)
    return (
      <View style={style} testID={`cup-match-${m.id}`}>
        {body}
      </View>
    );
  return (
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
}

/** 컵 경기 상세(득점 기록). 누구나 보는 화면이라 홈·원정 순서 그대로 보여 준다. */
function CupMatchDetail({
  cupId,
  matchId,
  back,
}: {
  cupId: string;
  matchId: string;
  back: () => void;
}) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<CupMatchResponse | null>(null);
  const load = async () => {
    setStatus('loading');
    const r = await fetchCupMatch(cupId, matchId);
    if (r.ok) setData(r.data);
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
      <Btn block onPress={back} testID="cup-match-back">
        {L.detailBack}
      </Btn>
    </Card>
  );
}

function CupBody({ state }: { state: CupState }) {
  const { cup: data, me } = state;
  const [matchId, setMatchId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean> | null>(null);
  const [openRounds, setOpenRounds] = useState<Record<string, boolean> | null>(null);
  if (!data)
    return (
      <Card gap={10}>
        <LoadState status={state.status} failText={L.loadFail} retry={() => void state.reload()}>
          {null}
        </LoadState>
      </Card>
    );
  if (matchId)
    return <CupMatchDetail cupId={data.cup.id} matchId={matchId} back={() => setMatchId(null)} />;

  const mineId = me?.entry && me.entry.status !== 'withdrawn' ? me.entry.teamId : null;
  const mineGroup = me?.entry?.group ?? null;
  const rounds = data.cup.rounds;
  const first = rounds[0];
  const groupOpen = (no: number) => (openGroups ?? { [mineGroup ?? -1]: true })[no] ?? false;
  const nextRound = data.matches.find((m) => !m.played)?.round;
  const roundOpen = (r: CupRound) =>
    (openRounds ?? { [nextRound && KO_ROUNDS.includes(nextRound) ? nextRound : 'f']: true })[r] ??
    false;
  const koMatches = (r: CupRound) =>
    data.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
  const koRounds = KO_ROUNDS.filter((r) => koMatches(r).length);
  const open = (m: CupMatch) => setMatchId(m.id);
  const closeInclusive = new Date(Date.parse(data.cup.closesAt) - 60_000).toISOString();

  return (
    <>
      <CupCard state={state} />

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
      </Card>

      <Card gap={6} testID="cup-schedule">
        <Txt v="h2" accessibilityRole="header">
          {L.secSchedule}
        </Txt>
        <Kv
          k={L.schedEntry}
          v={`${dayTimeText(data.cup.opensAt)} ~ ${dayTimeText(closeInclusive)}`}
        />
        <Kv k={L.schedDraw} v={dayTimeText(data.cup.drawAt)} />
        {rounds.map((r) => (
          <Kv key={r.round} k={roundLabel(r.round)} v={dayTimeText(r.at)} />
        ))}
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
          <Kv
            key={s}
            k={stageLabel(s)}
            v={`${L.rewardReroll({ n: CUP_REWARDS[s].rerolls })}${CUP_REWARDS[s].trophy ? ` · ${L.rewardTrophy}` : ''}`}
          />
        ))}
        <Txt v="xs" tone="muted">
          {L.rewardNote}
        </Txt>
      </Card>

      <Card gap={6} testID="cup-groups">
        <Txt v="h2" accessibilityRole="header">
          {L.secGroups}
        </Txt>
        {data.groups.length ? (
          <>
            <Txt v="xs" tone="muted">
              {L.advanceNote}
            </Txt>
            {data.groups.map((g) => {
              const name = L.groupName({ no: g.no });
              const isOpen = groupOpen(g.no);
              return (
                <View key={g.no}>
                  <Fold
                    title={g.no === mineGroup ? `${name} · ${L.myGroup}` : name}
                    aside={L.teamsCount({ n: g.standings.length })}
                    open={isOpen}
                    label={A.groupToggle({ name })}
                    testID={`cup-group-${g.no}`}
                    toggle={() =>
                      setOpenGroups({
                        ...(openGroups ?? { [mineGroup ?? -1]: true }),
                        [g.no]: !isOpen,
                      })
                    }
                  />
                  {isOpen ? (
                    <View style={{ gap: 6 }}>
                      <Standings cup={data} standings={g.standings} mineId={mineId} />
                      {data.matches
                        .filter((m) => m.group === g.no && !KO_ROUNDS.includes(m.round))
                        .sort((a, b) => a.at.localeCompare(b.at))
                        .map((m) => (
                          <MatchLine key={m.id} cup={data} m={m} mineId={mineId} open={open} />
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
      </Card>

      <Card gap={6} testID="cup-bracket">
        <Txt v="h2" accessibilityRole="header">
          {L.secBracket}
        </Txt>
        {koRounds.length ? (
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
                      ...(openRounds ?? {
                        [nextRound && KO_ROUNDS.includes(nextRound) ? nextRound : 'f']: true,
                      }),
                      [r]: !isOpen,
                    })
                  }
                />
                {isOpen
                  ? list.map((m) => (
                      <MatchLine key={m.id} cup={data} m={m} mineId={mineId} open={open} />
                    ))
                  : null}
              </View>
            );
          })
        ) : (
          <Txt v="sm" tone="muted">
            {L.noBracket}
          </Txt>
        )}
      </Card>
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
    <Screen footer={<BackBar testID="cup-back" fallback={() => go('owner')} />}>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Offside Cup</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {state.cup ? L.fullTitle({ n: state.cup.cup.edition }) : L.title}
        </Txt>
      </View>
      <CupBody state={state} />
    </Screen>
  );
}
