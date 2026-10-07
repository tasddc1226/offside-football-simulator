// T-11-145 오프사이드 컵 — 홈의 컵 배너 · 신청/취소 · 편성 화면의 명단 마감 안내. 컵 전체 화면은 CupScreen.
// 서버가 대회를 치르므로 앱은 fetchCup(누구나) · fetchCupMe(내 참가·자격·다음 경기·명단 잠금)를 보여 주기만 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  enterCup,
  fetchCup,
  fetchCupMe,
  withdrawCup,
  type CupMeResponse,
  type CupResponse,
} from '@offside/app-core/api/cup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { cupAppText as A } from '@offside/app-core/i18n/ko/cupApp';
import { cupOnHome } from '@offside/app-core/cupHome';
import { CUP_REWARDS } from '@offside/contracts/cup';
import { type LoadStatus } from '../../components/LoadState';
import { toast } from '../../game/host';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Pill, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';
import { CupTrophy } from '../../ui/CupTrophy';
import { dayTimeText, phaseLabel, reasonText, roundLabel, stageLabel, whenText } from './cupText';

export interface CupState {
  cup: CupResponse | null;
  me: CupMeResponse | null;
  status: LoadStatus;
  /** silent: 화면을 비우지 않고 값만 바꾼다(당겨서 새로고침). */
  reload: (silent?: boolean) => Promise<void>;
}

/**
 * 대회·내 참가 상태를 불러온다. active가 false면(지난 시즌 팀 등) 부르지 않고, linked가 false면(로그인 전) 내 상태는
 * 묻지 않는다(대회는 누구나 보지만 내 상태는 로그인한 구단주만). 당겨서 새로고침하면 값만 조용히 바꾼다.
 */
export function useCup(active: boolean, linked = true): CupState {
  const [cup, setCup] = useState<CupResponse | null>(null);
  const [me, setMe] = useState<CupMeResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const sequence = useRef(0);
  const reload = useCallback(
    async (silent = false) => {
      const n = ++sequence.current;
      if (!silent) setStatus('loading');
      const [a, b] = await Promise.all([fetchCup(), linked ? fetchCupMe() : null]);
      if (n !== sequence.current) return;
      if (!a.ok) {
        if (!silent) setStatus('error');
        return;
      }
      setCup(a.data);
      if (b?.ok) setMe(b.data);
      else if (!silent || !linked) setMe(null);
      setStatus('ready');
    },
    [linked],
  );
  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);
  useOnPull(() => (active ? reload(true) : undefined));
  return { cup, me, status, reload };
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
          text: L.rewardReroll({ n: CUP_REWARDS[entry.stage].rerolls }),
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

  if (entry)
    return (
      <View style={{ gap: 6 }}>
        <Txt bold tone="good" testID="cup-entered">
          {L.entered}
        </Txt>
        <Txt v="sm" tone="muted">
          {L.enterLockNote}
        </Txt>
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
  if (!me)
    return (
      <Txt v="sm" tone="muted">
        {L.loginToEnter}
      </Txt>
    );
  const reason = me.eligibility.ok ? null : reasonText(me.eligibility, data.cup.minFilled);
  if (reason)
    return (
      <Txt v="sm" tone="warn" testID="cup-ineligible">
        {reason}
      </Txt>
    );
  return (
    <View style={{ gap: 6 }}>
      <Btn
        kind="primary"
        testID="cup-enter"
        disabled={busy !== null}
        onPress={() => void run('enter')}
      >
        {busy === 'enter' ? L.entering : L.enter}
      </Btn>
      <Txt v="sm" tone="muted">
        {L.enterLockNote}
      </Txt>
    </View>
  );
}

/** 컵 화면 맨 위 카드 · 홈 배너. onOpen이 있으면(홈) 첫 안내 한 줄과 '대회 보기'만 — 신청은 대회 화면에서 한다. */
export function CupCard({ state, onOpen }: { state: CupState; onOpen?: () => void }) {
  const { cup: data } = state;
  if (!data) return null;
  const lines = onOpen ? linesOf(state).slice(0, 1) : linesOf(state);
  return (
    <Card gap={8} testID="cup-banner">
      <View style={{ flexDirection: 'row', alignItems: onOpen ? 'center' : 'flex-start', gap: 10 }}>
        {onOpen ? <CupTrophy stage="champion" size={44} bare /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="eyebrow">Offside Cup</Txt>
          <Txt v="h2" accessibilityRole="header">
            {L.fullTitle({ n: data.cup.edition })}
          </Txt>
        </View>
        <Pill tone={data.phase === 'open' ? 'good' : undefined}>{phaseLabel(data.phase)}</Pill>
      </View>
      {lines.map((l, i) => (
        <Txt key={i} v="sm" bold={!!l.bold} tone={l.tone ?? 'ink'}>
          {l.text}
        </Txt>
      ))}
      {onOpen ? (
        <Btn kind="accent" testID="cup-open" onPress={onOpen}>
          {L.open}
        </Btn>
      ) : (
        <CupEntry state={state} />
      )}
    </Card>
  );
}

/** 편성 화면의 명단 마감 띠 — 잠겨 있거나 오늘 안에 잠길 때. */
export function CupLockNotice({ state }: { state: CupState }) {
  const c = useColors();
  const next = myNext(state);
  if (!state.cup || !next) return null;
  const lock = lockAtOf(state.cup, next.round);
  const now = Date.now();
  let text: string | null = null;
  if (state.me?.locked) text = L.lineupLocked;
  else if (lock && Date.parse(lock) > now && Date.parse(lock) - now < 24 * 3600_000)
    text = L.lineupBand({ when: whenText(lock, now) });
  if (!text) return null;
  return (
    <View
      testID="cup-lock-notice"
      accessibilityRole="alert"
      style={{
        borderWidth: 1,
        borderColor: alpha(c.warn, 0.5),
        backgroundColor: alpha(c.warn, 0.1),
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Txt v="sm">{text}</Txt>
    </View>
  );
}

/** 홈의 컵 배너(누구나 보는 대회 소식). 취소됐거나 끝난 지 일주일이 지났거나 불러오지 못하면 그리지 않는다. */
export function CupBanner({ onOpen }: { onOpen: () => void }) {
  const state = useCup(true, false);
  if (!state.cup || !cupOnHome(state.cup)) return null;
  return <CupCard state={state} onOpen={onOpen} />;
}
