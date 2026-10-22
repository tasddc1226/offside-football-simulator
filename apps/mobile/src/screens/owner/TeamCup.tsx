// T-11-145 오프사이드 컵 — 홈의 컵 배너 · 신청/취소 · 편성 화면의 명단 마감 안내. 컵 전체 화면은 CupScreen.
// 서버가 대회를 치르므로 앱은 fetchCup(누구나) · fetchCupMe(내 참가·자격·다음 경기·명단 잠금)를 보여 주기만 한다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  enterCup,
  fetchCup,
  fetchCupHome,
  type CupHomeResponse,
  fetchCupMe,
  withdrawCup,
  type CupMeResponse,
  type CupResponse,
} from '@offside/app-core/api/cup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { cupRewardText } from '@offside/app-core/cupReward';
import { cupAppText as A } from '@offside/app-core/i18n/ko/cupApp';
import { cupOnHome } from '@offside/app-core/cupHome';
import { cupEnterConfirmLines, cupEntryTeamAction } from '@offside/app-core/cupEntry';
import { divisionLabel } from '@offside/app-core/cupDivision';
import type { CupLineupBar } from '@offside/app-core/cupLineupBar';
import { type LoadStatus } from '../../components/LoadState';
import { toast } from '../../game/host';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Pill, Press, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';
import { TeamLogo } from '../../components/TeamLogo';
import { CupTrophy } from '../../ui/CupTrophy';
import { dayTimeText, phaseLabel, reasonText, roundLabel, stageLabel, whenText } from './cupText';

export interface CupState {
  cup: CupResponse | null;
  me: CupMeResponse | null;
  status: LoadStatus;
  /** silent: 화면을 비우지 않고 값만 바꾼다(당겨서 새로고침). */
  reload: (silent?: boolean) => Promise<void>;
  /** T-11-410 구간 대회: 다른 구간 보기. 내가 신청한 구간 id(없으면 null). */
  pick: (cupId: string) => void;
  myDivision: string | null;
}

/**
 * 대회·내 참가 상태를 불러온다. active가 false면(지난 시즌 팀 등) 부르지 않고, linked가 false면(로그인 전) 내 상태는
 * 묻지 않는다(대회는 누구나 보지만 내 상태는 로그인한 구단주만). 당겨서 새로고침하면 값만 조용히 바꾼다.
 */
export function useCup(active: boolean, linked = true): CupState {
  const [cup, setCup] = useState<CupResponse | null>(null);
  const [me, setMe] = useState<CupMeResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  // T-11-410 보고 있는 대회('current' = 서버가 내 구간으로 풀어 준다). 고른 뒤에는 그 id로 부른다.
  const [cupId, setCupId] = useState('current');
  const [myDivision, setMyDivision] = useState<string | null>(null);
  const sequence = useRef(0);
  const reload = useCallback(
    async (silent = false) => {
      const n = ++sequence.current;
      if (!silent) setStatus('loading');
      const [first, b] = await Promise.all([fetchCup(cupId), linked ? fetchCupMe(cupId) : null]);
      let a = first;
      if (n !== sequence.current) return;
      // 'current'는 대회 조회에선 마스터, 내 상태에선 내 구간이라 둘이 다르면 내 구간 대회를 다시 부른다.
      const mine = b?.ok ? b.data.cupId : undefined;
      if (cupId === 'current' && mine && a.ok && a.data.cup.id !== mine) {
        a = await fetchCup(mine);
        if (n !== sequence.current) return;
      }
      if (!a.ok) {
        if (!silent) setStatus('error');
        return;
      }
      setCup(a.data);
      if (b?.ok) {
        setMe(b.data);
        // '내 구간' 표시: 이 구간에 신청이 살아 있으면 여기, 이 구간 신청을 취소했으면 지운다.
        const at = b.data.cupId ?? a.data.cup.id;
        if (b.data.entry && b.data.entry.status !== 'withdrawn') setMyDivision(at);
        else setMyDivision((d) => (d === at ? null : d));
      } else if (!silent || !linked) setMe(null);
      setStatus('ready');
    },
    [linked, cupId],
  );
  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);
  useOnPull(() => (active ? reload(true) : undefined));
  const pick = useCallback((id: string) => setCupId(id), []);
  return { cup, me, status, reload, pick, myDivision };
}

/** 대회에서 팀 이름 찾기. 추첨 전이거나 대진이 안 정해졌으면 '미정'. */
export function teamNameIn(cup: CupResponse, id: string | null): string {
  return (id && cup.teams.find((t) => t.teamId === id)?.name) || L.tbd;
}

/** 지금 내 팀이 치를 다음 경기(진행 중인 참가자만). */
function myNext(state: CupState) {
  const entry = state.me?.entry;
  return entry?.status === 'active' ? state.me?.next : null;
}

function lockAtOf(cup: CupResponse, round: string): string | null {
  return cup.cup.rounds.find((r) => r.round === round)?.lockAt ?? null;
}

type Line = { text: string; bold?: boolean; tone?: 'good' | 'warn' | 'muted' };

/** 단계와 내 상태에 맞는 안내 줄. */
function linesOf(state: CupState): Line[] {
  const { cup: data, me } = state;
  if (!data) return [];
  const entry = me?.entry && me.entry.status !== 'withdrawn' ? me.entry : null;
  const now = Date.now();
  const lines: Line[] = [];
  switch (data.phase) {
    case 'soon':
      lines.push({ text: L.soonLine({ at: dayTimeText(data.cup.opensAt) }) });
      break;
    case 'open':
      lines.push({
        text: L.openLine({
          entries: data.entries,
          cap: data.cup.capacity,
          until: dayTimeText(new Date(Date.parse(data.cup.closesAt) - 60_000).toISOString()),
        }),
      });
      break;
    case 'closed':
      lines.push({ text: L.closedLine({ at: dayTimeText(data.cup.drawAt) }) });
      if (!entry) lines.push({ text: L.notEntered, tone: 'muted' });
      break;
    case 'cancelled':
      lines.push({ text: L.cancelledLine });
      break;
    case 'group':
    case 'knockout':
    case 'done': {
      if (data.phase === 'group')
        lines.push({ text: L.groupLine({ teams: data.teams.length || data.entries }) });
      else if (data.phase === 'knockout') {
        const round = data.matches.find((m) => !m.played)?.round;
        if (round) lines.push({ text: L.knockoutLine({ round: roundLabel(round) }) });
      } else if (data.championTeamId)
        lines.push({
          text: L.doneLine({ team: teamNameIn(data, data.championTeamId) }),
          bold: true,
        });
      if (!entry) {
        lines.push({ text: L.notEntered, tone: 'muted' });
        break;
      }
      if (entry.status === 'active') {
        const next = me?.next;
        if (next) {
          const mine = entry.teamId;
          const opp = next.homeTeamId === mine ? next.awayTeamId : next.homeTeamId;
          lines.push({
            text: L.nextMatch({
              round: roundLabel(next.round),
              vs: teamNameIn(data, opp),
              at: whenText(next.at, now),
            }),
            bold: true,
          });
          // T-11-405 다음 경기 예상(지금 두 팀 명단 기준). 토너먼트면 무승부 뒤 승부차기 안내를 붙인다.
          const odds = me?.nextOdds;
          if (odds) {
            lines.push({ text: L.oddsLine(odds) });
            lines.push({
              text: next.group === null ? `${L.oddsNote} ${L.oddsKoNote}` : L.oddsNote,
              tone: 'muted',
            });
          }
          const lock = lockAtOf(data, next.round);
          if (me?.locked) lines.push({ text: L.lockedNow, tone: 'warn' });
          else if (lock)
            lines.push({ text: L.lockNote({ when: whenText(lock, now) }), tone: 'warn' });
        } else lines.push({ text: L.nextPending, tone: 'muted' });
      } else if (entry.stage) {
        if (entry.status === 'champion' || entry.stage === 'champion')
          lines.push({ text: L.youWon, bold: true, tone: 'good' });
        else lines.push({ text: L.myResult({ stage: stageLabel(entry.stage) }), bold: true });
        lines.push({
          text: cupRewardText(data.cup.edition, entry.stage, false),
          tone: 'muted',
        });
      }
      break;
    }
  }
  return lines;
}

/** 접수 중이면 신청 · 취소 버튼과 신청할 수 없는 이유. */
function CupEntry({ state }: { state: CupState }) {
  const { cup: data, me, reload } = state;
  const [busy, setBusy] = useState<'enter' | 'withdraw' | null>(null);
  const lock = useRef(false);
  if (!data || data.phase !== 'open') return null;
  const entry = me?.entry && me.entry.status !== 'withdrawn' ? me.entry : null;
  const cupId = data.cup.id;

  async function run(kind: 'enter' | 'withdraw') {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    try {
      const r = await (kind === 'enter' ? enterCup(cupId) : withdrawCup(cupId));
      if (!r.ok) toast(r.error.message || A.actionFail);
      else toast(kind === 'enter' ? L.toastEntered : L.toastWithdrawn);
      await reload(true);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  const askWithdraw = () =>
    Alert.alert(A.withdrawAskTitle, L.withdrawConfirm, [
      { text: A.withdrawKeep, style: 'cancel' },
      { text: L.withdraw, style: 'destructive', onPress: () => void run('withdraw') },
    ]);

  // T-11-443 신청 전 한 번 더 묻는다(선발 잠금 · 구간 상한 · 접수 중 취소 가능).
  const askEnter = () =>
    Alert.alert(
      L.enterAskTitle,
      cupEnterConfirmLines(data.cup)
        .map((l) => `· ${l}`)
        .join('\n'),
      [
        { text: L.enterAskCancel, style: 'cancel' },
        { text: L.enterAskOk, onPress: () => void run('enter') },
      ],
    );
  // T-11-443 편성을 고치면 풀리는 이유면 팀 편성 화면으로.
  const openTeam = () => {
    appState.teamView = 'team';
    go('team');
  };

  if (entry)
    return (
      <View style={{ gap: 6 }}>
        <Txt bold tone="good" testID="cup-entered">
          {L.entered}
        </Txt>
        <Txt v="sm" tone="muted">
          {L.enterLockNote}
        </Txt>
        {data.cup.ovrMax != null ? (
          <Txt v="sm" tone="muted">
            {L.divisionLockNote({ cap: data.cup.ovrMax })}
          </Txt>
        ) : null}
        <Btn
          sm
          kind="ghost"
          testID="cup-withdraw"
          disabled={busy !== null}
          onPress={askWithdraw}
          style={{ alignSelf: 'flex-start' }}
        >
          {busy === 'withdraw' ? L.withdrawing : L.withdraw}
        </Btn>
      </View>
    );
  if (!me) return null;
  const reason = me.eligibility.ok
    ? null
    : reasonText(me.eligibility, data.cup.minFilled, me.ovr ?? undefined, data.cup.ovrMax);
  const fit = divisionFitText(data, me);
  const capNote = data.cup.ovrMax != null ? L.divisionLockNote({ cap: data.cup.ovrMax }) : null;
  const teamAction = cupEntryTeamAction(me.eligibility);
  if (reason)
    return (
      <View style={{ gap: 6 }}>
        <Txt v="sm" tone="warn" testID="cup-ineligible">
          {reason}
        </Txt>
        {fit && !me.eligibility.ok && me.eligibility.reason === 'over-cap' ? (
          <Txt v="sm" tone="muted" testID="cup-fit">
            {fit}
          </Txt>
        ) : null}
        {teamAction ? (
          <Btn sm testID="cup-to-lineup" onPress={openTeam} style={{ alignSelf: 'flex-start' }}>
            {teamAction}
          </Btn>
        ) : null}
      </View>
    );
  return (
    <View style={{ gap: 6 }}>
      <Btn kind="primary" testID="cup-enter" disabled={busy !== null} onPress={askEnter}>
        {busy === 'enter' ? L.entering : L.enter}
      </Btn>
      <Txt v="sm" tone="muted">
        {L.enterLockNote}
      </Txt>
      {capNote ? (
        <Txt v="sm" tone="muted">
          {capNote}
        </Txt>
      ) : null}
      {fit ? (
        <Txt v="sm" tone="muted" testID="cup-fit">
          {fit}
        </Txt>
      ) : null}
    </View>
  );
}

/** T-11-410 내 OVR로 들어갈 가장 낮은 구간 안내(구간 대회만). */
function divisionFitText(data: CupResponse, me: CupMeResponse): string | null {
  const ovr = me.ovr;
  if (!data.divisions || ovr == null) return null;
  const lowest = data.divisions.find(
    (d) => d.division === 'master' || (d.ovrMax != null && ovr <= d.ovrMax),
  );
  const name = lowest && divisionLabel(lowest.division);
  return name ? L.divisionFit({ ovr, division: name }) : null;
}

/** 컵 화면 맨 위 카드 · 홈 배너. onOpen이 있으면(홈) 첫 안내 한 줄과 '대회 보기'만 — 신청은 대회 화면에서 한다. */
export function CupCard({
  state,
  onOpen,
  onSchedule,
}: {
  state: CupState;
  onOpen?: () => void;
  onSchedule?: () => void;
}) {
  const { cup: data } = state;
  if (!data) return null;
  const entry = state.me?.entry;
  const registeredTeam =
    !onOpen && entry && entry.status !== 'withdrawn'
      ? data.teams.find((t) => t.teamId === entry.teamId)
      : undefined;
  const lines = onOpen ? linesOf(state).slice(0, 1) : linesOf(state);
  const card = (
    <Card gap={8} testID="cup-banner">
      {onSchedule ? (
        <Press
          onPress={onSchedule}
          accessibilityLabel={`${lines.map((l) => l.text).join(' ')} · ${L.scheduleMatches}`}
          style={{ minHeight: 44, justifyContent: 'center', gap: 8 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Pill>{phaseLabel(data.phase)}</Pill>
            <Txt tone="muted" accessible={false}>
              ↓
            </Txt>
          </View>
          {lines.map((l, i) => (
            <Txt key={i} v="sm" bold={!!l.bold} tone={l.tone ?? 'ink'}>
              {l.text}
            </Txt>
          ))}
        </Press>
      ) : (
        <View
          style={{ flexDirection: 'row', alignItems: onOpen ? 'center' : 'flex-start', gap: 10 }}
        >
          {onOpen ? (
            <CupTrophy stage="champion" edition={data?.cup.edition} size={44} bare />
          ) : null}
          {onOpen ? (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="eyebrow">Offside Cup</Txt>
              <Txt v="h2" accessibilityRole="header">
                {L.fullTitle({ n: data.cup.edition })}
              </Txt>
            </View>
          ) : null}
          <Pill tone={data.phase === 'open' ? 'good' : undefined}>{phaseLabel(data.phase)}</Pill>
        </View>
      )}
      {registeredTeam ? (
        <View
          testID="cup-registered-team"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
        >
          <TeamLogo logo={registeredTeam.logo} name={registeredTeam.name} size={40} decorative />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt v="xs" tone="muted">
              {L.registeredTeam}
            </Txt>
            <Txt bold>{registeredTeam.name}</Txt>
            <Txt v="xs" tone="muted">
              {registeredTeam.owner}
            </Txt>
          </View>
          <Txt v="sm" num>{`OVR ${registeredTeam.ovr}`}</Txt>
        </View>
      ) : null}
      {!onSchedule &&
        lines.map((l, i) => (
          <Txt key={i} v="sm" bold={!!l.bold} tone={l.tone ?? 'ink'}>
            {l.text}
          </Txt>
        ))}
      {!onOpen && <CupEntry state={state} />}
    </Card>
  );
  return onOpen ? (
    <Press
      onPress={onOpen}
      testID="cup-open"
      scale={0.985}
      accessibilityLabel={`${L.fullTitle({ n: data.cup.edition })} · ${L.open}`}
    >
      {card}
    </Press>
  ) : (
    card
  );
}

/**
 * 편성 화면의 명단 마감 띠 — 잠겨 있거나 오늘 안에 잠길 때. T-11-436 참가 중이거나 신청을 받는 중이면 팀 OVR · 구간 상한과
 * 선발 · 최소 인원 줄(bar)을 늘 보이고, 넘거나 모자라면 이유를 붙인다.
 */
export function CupLockNotice({
  state,
  bar = null,
}: {
  state: CupState;
  bar?: CupLineupBar | null;
}) {
  const c = useColors();
  const next = myNext(state);
  const lock = state.cup && next ? lockAtOf(state.cup, next.round) : null;
  const now = Date.now();
  let text: string | null = null;
  if (next && state.me?.locked) text = L.lineupLocked;
  else if (lock && Date.parse(lock) > now && Date.parse(lock) - now < 24 * 3600_000)
    text = L.lineupBand({ when: whenText(lock, now) });
  if (!text && !bar) return null;
  const warn = !!text || !!bar?.notes.length;
  return (
    <View
      testID="cup-lock-notice"
      accessibilityRole={warn ? 'alert' : undefined}
      style={{
        borderWidth: 1,
        borderColor: alpha(warn ? c.warn : c.good, 0.5),
        backgroundColor: alpha(warn ? c.warn : c.good, 0.1),
        borderRadius: RADIUS.md,
        padding: 12,
        gap: 4,
      }}
    >
      {bar ? (
        <Txt v="xs" bold>
          {L.title}
        </Txt>
      ) : null}
      {text ? <Txt v="sm">{text}</Txt> : null}
      {bar ? (
        <View testID="cup-rule" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
          {bar.ovrText ? (
            <Txt
              v="sm"
              num
              bold={bar.overCap}
              tone={bar.overCap ? 'bad' : 'ink'}
              testID="cup-rule-ovr"
            >
              {bar.ovrText}
            </Txt>
          ) : null}
          <Txt
            v="sm"
            num
            bold={bar.short}
            tone={bar.short ? 'bad' : 'ink'}
            testID="cup-rule-filled"
          >
            {bar.filledText}
          </Txt>
        </View>
      ) : null}
      {bar?.notes.map((note) => (
        <Txt key={note} v="sm" tone="bad" testID="cup-rule-note">
          {note}
        </Txt>
      ))}
    </View>
  );
}

/** 홈의 컵 배너(누구나 보는 대회 소식). 취소됐거나 끝난 지 일주일이 지났거나 불러오지 못하면 그리지 않는다. */
export function CupBanner({ onOpen }: { onOpen: () => void }) {
  const [data, setData] = useState<CupHomeResponse | null>(null);
  const reload = useCallback(async () => {
    const r = await fetchCupHome();
    if (r.ok) setData(r.data);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useOnPull(reload);
  if (!data || !cupOnHome(data)) return null;
  let text: string;
  switch (data.phase) {
    case 'soon':
      text = L.soonLine({ at: dayTimeText(data.cup.opensAt) });
      break;
    case 'open':
      text = L.openLine({
        entries: data.entries,
        cap: data.cup.capacity,
        until: dayTimeText(new Date(Date.parse(data.cup.closesAt) - 60_000).toISOString()),
      });
      break;
    case 'closed':
      text = L.closedLine({ at: dayTimeText(data.cup.drawAt) });
      break;
    case 'group':
      text = L.groupLine({ teams: data.teamCount || data.entries });
      break;
    case 'knockout':
      text = data.round ? L.knockoutLine({ round: roundLabel(data.round) }) : L.notEntered;
      break;
    case 'done':
      text = data.championName ? L.doneLine({ team: data.championName }) : L.notEntered;
      break;
    case 'cancelled':
      text = L.cancelledLine;
      break;
  }
  return (
    <Press
      onPress={onOpen}
      testID="cup-open"
      scale={0.985}
      accessibilityLabel={`${L.fullTitle({ n: data.cup.edition })} · ${L.open}`}
    >
      <Card gap={8} testID="cup-banner">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CupTrophy stage="champion" edition={data?.cup.edition} size={44} bare />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="eyebrow">Offside Cup</Txt>
            <Txt v="h2" accessibilityRole="header">
              {L.fullTitle({ n: data.cup.edition })}
            </Txt>
          </View>
          <Pill tone={data.phase === 'open' ? 'good' : undefined}>{phaseLabel(data.phase)}</Pill>
        </View>
        <Txt v="sm" bold={data.phase === 'done' && !!data.championName}>
          {text}
        </Txt>
      </Card>
    </Press>
  );
}
