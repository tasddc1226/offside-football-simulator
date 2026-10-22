// T-11-310 감독 커리어(웹 Manager.svelte) — 구단주 화면의 '감독 커리어' 카드로 연다. 지금 가진 선수 카드로 감독 커리어를
// 시작하고(한 번에 하나), 기기에서 시즌을 돌린 뒤 감독 카드로 확정해 우리 팀 감독 칸에 앉힌다. 화면을 열 때 목록을 한 번 받는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import type { ManagerCandidate, ManagerCareer, ManagersResponse } from '@offside/contracts';
import { FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
import type { ManagerStyle } from '@offside/contracts/manager-rules';
import {
  MANAGER_STYLES,
  acceptOffer,
  answerEvent,
  boardMinimum,
  closeEvents,
  continueAfterResult,
  currentEvent,
  endingDesc,
  endingName,
  leagueName,
  managerEventText,
  managerMatchday,
  managerResult,
  masteryGrade,
  snapshot,
  pickTransfer,
  restSeason,
  setupSeason,
  specialDesc,
  specialName,
  stayAtClub,
  styleDesc,
  styleName,
  targetName,
  targetOptions,
  transferDesc,
  transferName,
  type BoardTarget,
  type ManagerState,
} from '@offside/game/manager';
import { tn } from '@offside/game/i18n/names';
import { POS_LABEL } from '@offside/game/pos-label';
import { localCareerNames } from '@offside/game/hof-store';
import {
  abandonManager,
  choiceOddsLabels,
  clearManagerState,
  coachEffectText,
  eventOutcome,
  fetchManagers,
  finishManager,
  loadManagerState,
  managerBar,
  managerName,
  managerStats,
  managerSheetLabel,
  managerSteps,
  masteryUpLine,
  releaseManager,
  seasonBadges,
  seasonChips,
  statChips,
  statDelta,
  type Chip,
  type ManagerStatKey,
  saveManagerState,
  setTeamCoach,
  startConfirmLines,
  finishConfirmLines,
  startManager,
} from '@offside/app-core/manager';
import { fundsText } from '@offside/app-core/funds';
import { managerText as M } from '@offside/app-core/i18n/ko/manager';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { ActionBar, Btn, Card, Opt, Press, Screen, Topbar, Txt } from '../../ui';
import { DISPLAY } from '../../theme/type';
import { ProgBar } from '../../sheets/parts';
import { PopSheet } from '../../ui/PopSheet';
import { useRefresh } from '../../ui/refresh';
import { LoginButtons } from './LoginButtons';
import { ManagerLive } from './ManagerLive';
import { buzz } from '../../game/host';
import { CountUp } from '../../components/CountUp';
import { Chips } from '../../sheets/Chips';
import { Pop } from '../../sheets/anim';
import { Skeleton } from '../../ui/Skeleton';

type CardRules = {
  mastery: Record<FormationId, string>;
  style: ManagerStyle;
  specials: readonly ('wing' | 'midfield' | 'defense' | 'counter' | 'youth')[];
};
const RANK: Record<string, number> = { S: 3, A: 2, B: 1, C: 0 };
const bestFormation = (m: CardRules): FormationId =>
  FORMATION_IDS.reduce((a, f) => (RANK[m.mastery[f]!]! > RANK[m.mastery[a]!]! ? f : a));
const small = { fontSize: rem(FONT.body2) } as const;
const tiny = { fontSize: rem(FONT.caption) } as const;

/** 감독 카드 몸통(숙련 · 성향 · 특기 · 감독 칸 효과). */
function CardBody({ r }: { r: CardRules }) {
  const f = bestFormation(r);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {FORMATION_IDS.map((x) => (
          <Chip key={x} title={x} sub={M.mastery({ grade: r.mastery[x]! })} />
        ))}
      </View>
      <Txt style={small}>
        {`${M.style} ${styleName(r.style)} · ${M.specials} ${
          r.specials.length ? r.specials.map(specialName).join(' · ') : M.noSpecials
        }`}
      </Txt>
      {r.specials.map((k) => (
        <Txt key={k} tone="muted" style={tiny}>{`${specialName(k)}: ${specialDesc(k)}`}</Txt>
      ))}
      <Txt style={small}>
        {`${M.effect} (${M.effectFor({ formation: f })}) ${coachEffectText(r as never, f)}`}
      </Txt>
    </View>
  );
}

function Chip({ title, sub }: { title: string; sub?: string | undefined }) {
  const c = useColors();
  return (
    <View
      style={{
        alignItems: 'center',
        minWidth: 56,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Txt bold style={small}>
        {title}
      </Txt>
      {sub ? (
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

function Row({
  title,
  sub,
  note,
  action,
}: {
  title: string;
  sub?: string;
  note?: string;
  action?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: c.surface2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt bold>{title}</Txt>
        {sub ? <Txt style={tiny}>{sub}</Txt> : null}
        {note ? (
          <Txt tone="muted" style={tiny}>
            {note}
          </Txt>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export default function Manager() {
  const c = useColors();
  const local = useMemo(() => localCareerNames(), []);
  const [data, setData] = useState<ManagersResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loginNeeded, setLoginNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // T-11-345 방금 경질한 감독 알림.
  const [released, setReleased] = useState<string | null>(null);
  const [st, setSt] = useState<ManagerState | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  // 방금 답한 이벤트가 바꾼 상태(변화 칩), 경기 중계 중인 시즌 번호(다시 열면 중계 없이 결산).
  const [evChips, setEvChips] = useState<Chip[]>([]);
  const [live, setLive] = useState<number | null>(null);
  // T-11-329 방금 바뀐 상단 상태 칸(+3 · −2)과 그 표시를 다시 띄우는 번호. 숫자는 처음 그린 뒤부터 바뀔 때만 차오른다.
  const [delta, setDelta] = useState<{ d: Partial<Record<ManagerStatKey, number>>; n: number }>({
    d: {},
    n: 0,
  });
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [pick, setPick] = useState<{
    formation: FormationId;
    style: ManagerStyle;
    target: BoardTarget;
  }>({ formation: '4-3-3', style: 'balance', target: 'mid' });
  const [retryN, setRetryN] = useState(0);
  const { tick, track } = useRefresh();

  const nameOf = (m: Pick<ManagerCareer, 'careerId' | 'publicName' | 'number' | 'origin'>) =>
    managerName(
      { careerId: m.careerId, publicName: m.publicName, number: m.number, pos: m.origin.pos },
      local,
    );
  const resetPick = (s: ManagerState) =>
    setPick({ formation: s.formation, style: s.style, target: boardMinimum(s) });

  async function load() {
    setFailed(false);
    const r = await track(fetchManagers());
    if (!r.ok) {
      const login =
        r.error.reason === 'GOOGLE_LOGIN_REQUIRED' || r.error.code === 'PROFILE_REQUIRED';
      setLoginNeeded(login);
      setFailed(!login);
      return;
    }
    setLoginNeeded(false);
    setData(r.data);
    const s = r.data.active ? loadManagerState(r.data.active, nameOf(r.data.active)) : null;
    // T-11-338 서버에 진행 중 감독이 없으면(다른 기기에서 끝냄 · 포기) 남은 세이브를 지워 이어 하기 카드가 뜨지 않게 한다.
    if (!r.data.active) clearManagerState();
    setSt(s);
    if (s) resetPick(s);
  }
  useEffect(() => {
    void load();
  }, [tick, retryN]);

  /** 엔진 함수로 상태를 바꾸고 저장한다. 엔진이 제자리에서 바꾸므로 사본에 적용해 새 상태로 넣는다(세이브와 같은 JSON 모양). */
  function act(fn: (s: ManagerState) => unknown): ManagerState | null {
    if (!st) return null;
    const next = JSON.parse(JSON.stringify(st)) as ManagerState;
    fn(next);
    saveManagerState(next);
    if (next.phase === 'setup') resetPick(next);
    setDelta((x) => ({ d: statDelta(snapshot(st), snapshot(next)), n: x.n + 1 }));
    setSt(next);
    return next;
  }
  function answer(id: string, i: number) {
    if (!st) return;
    const before = snapshot(st);
    setAnswered(id);
    const next = act((s) => answerEvent(s, i));
    setEvChips(next ? statChips(before, snapshot(next)) : []);
    buzz();
  }
  function playSeason() {
    const h = act(closeEvents)?.history.at(-1);
    if (h?.clubId) setLive(h.n);
  }
  function liveDone() {
    setLive(null);
    const h = st?.history.at(-1);
    if (h && seasonBadges(h).some((b) => !b.bad)) buzz();
  }
  async function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.error?.message ?? M.loadFail);
    return r.ok;
  }
  const askStart = (cand: ManagerCandidate) =>
    Alert.alert(
      M.confirmTitle({ name: managerName(cand, local) }),
      startConfirmLines(cand)
        .map((l) => `· ${l}`)
        .join('\n'),
      [
        { text: M.cancel, style: 'cancel' },
        {
          text: M.confirmOk,
          onPress: () =>
            void run(() => startManager(cand.careerId)).then((ok) => ok && void load()),
        },
      ],
    );
  // T-11-451 시즌을 다 마친 뒤에도 확정 전에는 원래 선수로 돌아갈 수 있다(서버는 포기와 같다).
  const undo = st?.phase === 'done';
  const askAbandon = () =>
    Alert.alert(undo ? M.undo : M.abandon, undo ? M.undoConfirm : M.abandonConfirm, [
      { text: M.cancel, style: 'cancel' },
      {
        text: undo ? M.undoOk : M.abandonOk,
        style: 'destructive',
        onPress: () => {
          if (!st) return;
          const id = st.id;
          void run(() => abandonManager(id)).then((ok) => {
            if (!ok) return;
            clearManagerState();
            void load();
          });
        },
      },
    ]);
  async function finish() {
    const res = st && managerResult(st);
    if (!st || !res) return;
    const id = st.id;
    if (await run(() => finishManager(id, res))) {
      clearManagerState();
      await load();
    }
  }
  // T-11-443 '감독 카드로 확정'은 되돌릴 수 없어 한 번 더 묻는다.
  const askFinish = () =>
    Alert.alert(
      M.finishTitle,
      finishConfirmLines()
        .map((l) => `· ${l}`)
        .join('\n'),
      [
        { text: M.cancel, style: 'cancel' },
        { text: M.finishOk, onPress: () => void finish() },
      ],
    );
  async function seat(id: string | null) {
    setReleased(null);
    if (await run(() => setTeamCoach(id))) await load();
  }
  // T-11-345 끝낸 감독 경질. 감독 칸에 앉아 있으면 먼저 비우라고만 알린다.
  const askRelease = (m: ManagerCareer) => {
    const name = nameOf(m);
    if (data?.coachId === m.careerId) return Alert.alert(M.release, M.releaseSeated);
    Alert.alert(
      M.releaseTitle({ name }),
      [
        m.releaseValue ? M.releasePay({ amount: fundsText(m.releaseValue) }) : M.releaseNoPay,
        M.releaseKeep,
        M.releaseFinal,
      ]
        .map((l) => `· ${l}`)
        .join('\n'),
      [
        { text: M.cancel, style: 'cancel' },
        {
          text: M.releaseOk,
          style: 'destructive',
          onPress: () =>
            void releaseManager(m.id).then((r) => {
              if (!r.ok) return Alert.alert(M.releaseFail, r.error.message);
              setReleased(M.releaseDone({ name }));
              void load();
            }),
        },
      ],
    );
  };

  const ev = st && st.phase === 'event' ? currentEvent(st) : null;
  const shownEv = st && answered ? (st.events.find((e) => e.id === answered) ?? null) : ev;
  const lastSeason = st?.history.at(-1) ?? null;
  const result = st && st.phase === 'done' ? managerResult(st) : null;
  const targets = st && st.phase === 'setup' ? targetOptions(st) : [];
  const minTarget = st && st.phase === 'setup' ? boardMinimum(st) : null;
  const steps = st ? managerSteps(st) : null;
  // T-11-330 지금 단계가 창으로 뜨면 그 창 이름(창이 아니면 null). step이 바뀌면 창 맨 위로 돌아간다.
  const sheetLabel = st && data?.active ? managerSheetLabel(st, live !== null) : null;
  const sheetStep = st
    ? `${st.season}:${st.phase}:${shownEv?.id ?? ''}:${answered ?? ''}:${live ?? ''}`
    : '';
  const bar =
    st && data?.active
      ? managerBar(st, {
          answered: !!answered,
          live: st.phase === 'result' && !!lastSeason?.club && live === lastSeason.n,
        })
      : null;
  /** T-11-329 아래 고정 버튼이 하는 일(전에는 각 카드 맨 아래 버튼이 했다). */
  function onBar() {
    if (!bar) return;
    if (bar.act === 'manager-rest') act(restSeason);
    else if (bar.act === 'manager-season') act((s) => setupSeason(s, pick));
    else if (bar.act === 'manager-next') {
      setAnswered(null);
      setEvChips([]);
    } else if (bar.act === 'manager-result') playSeason();
    else if (bar.act === 'manager-continue') act(continueAfterResult);
    else askFinish();
  }
  const errLine = error ? (
    <Txt tone="bad" bold accessibilityRole="alert">
      {error}
    </Txt>
  ) : null;

  const play =
    st && data?.active ? (
      <>
        <Card gap={10} testID={`manager-play-${st.phase}`}>
          <View style={{ gap: 2 }}>
            <Txt v="h2">{nameOf(data.active)}</Txt>
            <Txt tone="muted" style={small}>
              {M.progress({
                season: Math.min(st.season + (st.phase === 'done' ? 0 : 1), st.seasonsTotal),
                total: st.seasonsTotal,
                age: st.age,
              })}
            </Txt>
            <Txt style={small}>
              {st.club ? `${tn(st.club.name)} · ${leagueName(st.club.leagueId)}` : M.noClub}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {managerStats(st).map(({ k, label, v }) => (
              <View
                key={k}
                testID={`manager-stat-${k}`}
                style={{
                  width: '31.5%',
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: RADIUS.sm,
                  backgroundColor: c.surface2,
                }}
              >
                <Txt tone="muted" style={tiny}>
                  {label}
                </Txt>
                {/* T-11-329 선수 OVR처럼 값이 바뀌면 차오르고, 방금 바뀐 칸 옆에 +3 · −2가 뜬다. */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Txt bold num>
                    <CountUp value={v} animate={ready} ms={600} />
                  </Txt>
                  {delta.d[k] ? (
                    <Pop key={delta.n}>
                      <Txt
                        bold
                        tone={delta.d[k]! < 0 ? 'bad' : 'good'}
                        style={tiny}
                        testID="manager-delta"
                      >
                        {delta.d[k]! > 0 ? `+${delta.d[k]}` : `−${-delta.d[k]!}`}
                      </Txt>
                    </Pop>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          <Txt tone="muted" style={small}>
            {`${M.record({ w: st.wins, d: st.draws, l: st.losses })} · ${M.honors({
              titles: st.titles,
              cups: st.cups,
              promotions: st.promotions,
            })}`}
          </Txt>
          {st.log.map((line, i) => (
            <Txt key={i} style={small}>
              {line}
            </Txt>
          ))}
          {steps ? (
            // T-11-329 선수 커리어 진행 막대처럼 이번 시즌이 어디까지 왔는지
            <View style={{ gap: 6 }} testID={`manager-steps-${steps.active}`}>
              <ProgBar progress={steps.progress} fill={300} />
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}
                accessibilityLabel={`${M.stepsLabel}: ${steps.steps[steps.active]}`}
              >
                {steps.steps.map((t, i) => (
                  <Txt
                    key={i}
                    tone={i === steps.active ? 'ink' : 'muted'}
                    bold={i === steps.active}
                    style={tiny}
                  >
                    {i === steps.active ? <Txt style={{ color: c.accent }}>{'▸ '}</Txt> : null}
                    {i < steps.active ? <Txt style={{ color: c.good }}>{'✓ '}</Txt> : null}
                    {t}
                  </Txt>
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        {st.phase === 'setup' ? (
          <Card gap={10} testID="manager-setup">
            <Txt v="h2">{M.setupHeading}</Txt>
            <Txt tone="muted" bold style={tiny}>
              {M.formation}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {FORMATION_IDS.map((f) => (
                <Opt
                  key={f}
                  style={{ flex: 1, alignItems: 'center' }}
                  selected={pick.formation === f}
                  onPress={() => setPick((p) => ({ ...p, formation: f }))}
                >
                  <Txt bold>{f}</Txt>
                  <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
                    {M.mastery({ grade: masteryGrade(st.masteryXp[f]) })}
                  </Txt>
                </Opt>
              ))}
            </View>
            <Txt tone="muted" bold style={tiny}>
              {M.style}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {MANAGER_STYLES.map((k) => (
                <Opt
                  key={k}
                  style={{ flex: 1, alignItems: 'center' }}
                  selected={pick.style === k}
                  onPress={() => setPick((p) => ({ ...p, style: k }))}
                >
                  <Txt bold>{styleName(k)}</Txt>
                </Opt>
              ))}
            </View>
            <Txt tone="muted" style={small}>
              {styleDesc(pick.style)}
            </Txt>
            <Txt tone="muted" bold style={tiny}>
              {M.target}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {targets.map((t) => (
                <Opt
                  key={t}
                  style={{ minWidth: 72, alignItems: 'center' }}
                  selected={pick.target === t}
                  onPress={() => setPick((p) => ({ ...p, target: t }))}
                >
                  <Txt bold>{targetName(t)}</Txt>
                  {t === minTarget ? (
                    <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
                      {M.targetMin}
                    </Txt>
                  ) : null}
                </Opt>
              ))}
            </View>
            <Txt tone="muted" style={small}>
              {M.targetLead}
            </Txt>
          </Card>
        ) : st.phase === 'done' && result ? (
          <Card gap={10} testID="manager-done">
            <Txt v="h2">{M.doneHeading}</Txt>
            <View style={{ flexDirection: 'row', gap: 6 }} testID="manager-totals">
              {(
                [
                  [M.tallyW, result.wins],
                  [M.badgeTitle, result.titles],
                  [M.badgeCup, result.cups],
                  [M.badgePromoted, result.promotions],
                ] as const
              ).map(([l, v]) => (
                <View
                  key={l}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderRadius: RADIUS.sm,
                    backgroundColor: c.surface2,
                  }}
                >
                  <Txt bold style={{ fontSize: rem(FONT.title2), fontVariant: ['tabular-nums'] }}>
                    <CountUp value={v} />
                  </Txt>
                  <Txt tone="muted" style={tiny}>
                    {l}
                  </Txt>
                </View>
              ))}
            </View>
            <View
              style={{
                gap: 6,
                padding: 12,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <Pop delay={300} style={{ alignSelf: 'flex-start' }}>
                <Txt bold tone="accent" style={{ fontSize: rem(FONT.title2) }}>
                  {M.grade({ grade: result.grade })}
                </Txt>
              </Pop>
              <Txt bold>{endingName(result.ending)}</Txt>
              <Txt tone="muted" style={small}>
                {endingDesc(result.ending)}
              </Txt>
              <CardBody r={result} />
            </View>
            <Txt tone="muted" style={small}>
              {M.doneLead}
            </Txt>
            {errLine}
          </Card>
        ) : null}

        {/* T-11-330 선수 플레이처럼 고르거나 결과를 보는 단계(제의 · 영입 · 이벤트 · 경기 · 결산)는 아래에서 올라오는 창으로 띄운다. */}
        {sheetLabel ? (
          <PopSheet label={sheetLabel} step={sheetStep} testID="manager-sheet">
            {st.phase === 'offers' ? (
              <View style={{ gap: 10 }} testID="manager-offers">
                <Txt v="h2">{M.offersHeading}</Txt>
                {st.offers.length ? (
                  <>
                    <Txt tone="muted" style={small}>
                      {M.offersLead}
                    </Txt>
                    {st.offers.map((o, i) => (
                      <Row
                        key={o.clubId}
                        title={tn(o.name)}
                        sub={leagueName(o.leagueId)}
                        action={
                          <Btn
                            sm
                            kind="primary"
                            testID="manager-accept"
                            onPress={() => act((s) => acceptOffer(s, i))}
                          >
                            {M.accept}
                          </Btn>
                        }
                      />
                    ))}
                    {st.club ? (
                      <Btn testID="manager-stay" onPress={() => act(stayAtClub)}>
                        {M.stay}
                      </Btn>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Txt tone="muted" style={small}>
                      {M.restLead}
                    </Txt>
                  </>
                )}
                {bar ? (
                  <Btn block kind="primary" testID={bar.act} disabled={busy} onPress={onBar}>
                    {bar.label}
                  </Btn>
                ) : null}
              </View>
            ) : st.phase === 'transfer' ? (
              <View style={{ gap: 10 }} testID="manager-transfer">
                <Txt v="h2">{M.transferHeading}</Txt>
                <Txt tone="muted" style={small}>
                  {M.transferLead}
                </Txt>
                {st.transfers.map((t, i) => (
                  <Press
                    key={i}
                    testID="manager-transfer-pick"
                    onPress={() => act((s) => pickTransfer(s, i))}
                    scale={0.98}
                  >
                    <Row
                      title={transferName(t.kind)}
                      sub={M.transferSpec({ pos: tn(POS_LABEL[t.pos]), ovr: t.ovr, age: t.age })}
                      note={transferDesc(t.kind)}
                      action={<Txt tone="muted">›</Txt>}
                    />
                  </Press>
                ))}
                <Btn testID="manager-skip" onPress={() => act((s) => pickTransfer(s, -1))}>
                  {M.skip}
                </Btn>
              </View>
            ) : st.phase === 'event' ? (
              <View style={{ gap: 10 }} testID="manager-event">
                {shownEv ? (
                  (() => {
                    const t = managerEventText(shownEv.id);
                    return (
                      <>
                        <Txt v="eyebrow">
                          {M.eventHeading({
                            n: st.events.indexOf(shownEv) + 1,
                            total: st.events.length,
                          })}
                        </Txt>
                        <Txt v="h2">{t.t}</Txt>
                        <Txt>{t.b}</Txt>
                        {shownEv.result !== null ? (
                          <>
                            {(() => {
                              const out = eventOutcome(shownEv);
                              return out ? (
                                <>
                                  <Txt v="eyebrow">
                                    {M.eventResult({ label: t.choices[shownEv.choice ?? 0] ?? '' })}
                                  </Txt>
                                  <Pop>
                                    <Txt
                                      testID={`manager-outcome-${out.ok ? 'ok' : 'fail'}`}
                                      style={{
                                        fontFamily: DISPLAY[700],
                                        fontSize: rem(2.5),
                                        lineHeight: rem(2.5),
                                        color: out.ok ? c.good : c.bad,
                                      }}
                                    >
                                      {out.label}
                                    </Txt>
                                  </Pop>
                                </>
                              ) : null;
                            })()}
                            <View
                              style={{
                                padding: 12,
                                borderRadius: RADIUS.sm,
                                backgroundColor: c.surface2,
                              }}
                            >
                              <Txt testID="manager-event-result">{shownEv.result}</Txt>
                            </View>
                            <Chips chips={evChips} pop />
                          </>
                        ) : (
                          <View style={{ gap: 10 }}>
                            {t.choices.map((label, i) => {
                              const odds = choiceOddsLabels(shownEv.id)[i] ?? '';
                              return (
                                <Press
                                  key={i}
                                  testID="manager-choice"
                                  accessibilityRole="button"
                                  accessibilityLabel={M.oddsLabel({ label, odds })}
                                  onPress={() => answer(shownEv.id, i)}
                                  style={{
                                    borderWidth: 1.5,
                                    borderColor: 'transparent',
                                    backgroundColor: c.surface2,
                                    borderRadius: RADIUS.md,
                                    paddingVertical: 12,
                                    paddingHorizontal: 14,
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                >
                                  <Txt style={{ flex: 1, fontWeight: '600' }}>{label}</Txt>
                                  <View
                                    style={{
                                      paddingVertical: 2,
                                      paddingHorizontal: 8,
                                      borderRadius: RADIUS.sm,
                                      backgroundColor: c.surface2,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Txt
                                      style={{
                                        fontFamily: DISPLAY[700],
                                        fontSize: rem(FONT.body1),
                                      }}
                                    >
                                      {odds}
                                    </Txt>
                                  </View>
                                </Press>
                              );
                            })}
                          </View>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <Txt tone="muted" style={small}>
                    {M.liveEyebrow({ n: st.season + 1 })}
                  </Txt>
                )}
                {bar ? (
                  <Btn block kind="primary" testID={bar.act} disabled={busy} onPress={onBar}>
                    {bar.label}
                  </Btn>
                ) : null}
              </View>
            ) : st.phase === 'result' && lastSeason && live === lastSeason.n && lastSeason.club ? (
              <ManagerLive
                n={lastSeason.n}
                club={tn(lastSeason.club)}
                matches={managerMatchday(st.id, lastSeason)}
                onDone={liveDone}
              />
            ) : st.phase === 'result' && lastSeason ? (
              <View style={{ gap: 10 }} testID="manager-result-card">
                <Txt v="h2">{M.resultHeading({ n: lastSeason.n })}</Txt>
                {seasonBadges(lastSeason).length ? (
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                    testID="manager-badges"
                  >
                    {seasonBadges(lastSeason).map((b, i) => (
                      <Pop key={b.k} delay={i * 120}>
                        <View
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 12,
                            borderRadius: RADIUS.pill,
                            backgroundColor: b.bad ? c.bad : c.pitch,
                          }}
                        >
                          <Txt bold tone="onPitch" style={small}>
                            {b.label}
                          </Txt>
                        </View>
                      </Pop>
                    ))}
                  </View>
                ) : null}
                {lastSeason.clubId ? (
                  <Txt tone="muted" style={small}>
                    {M.record({ w: lastSeason.w, d: lastSeason.d, l: lastSeason.l })}
                  </Txt>
                ) : null}
                {lastSeason.lines.map((line, i) => (
                  <Txt key={i} style={small}>
                    {line}
                  </Txt>
                ))}
                {seasonChips(lastSeason).length || masteryUpLine(lastSeason) ? (
                  <View
                    testID="manager-change"
                    style={{ gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.line }}
                  >
                    <Txt tone="muted" bold style={tiny}>
                      {M.seasonChange}
                    </Txt>
                    <Chips chips={seasonChips(lastSeason)} pop split />
                    {masteryUpLine(lastSeason) ? (
                      <Txt bold tone="accent">
                        {masteryUpLine(lastSeason)}
                      </Txt>
                    ) : null}
                  </View>
                ) : null}
                {bar ? (
                  <Btn block kind="primary" testID={bar.act} disabled={busy} onPress={onBar}>
                    {bar.label}
                  </Btn>
                ) : null}
              </View>
            ) : null}
            {!(st.phase === 'result' && live !== null) ? (
              // 창이 떠 있는 동안에도 포기할 수 있게(화면의 포기 버튼은 창 뒤에 가린다).
              <Press
                testID="manager-abandon"
                onPress={askAbandon}
                style={{ alignSelf: 'center', paddingVertical: 6 }}
              >
                <Txt
                  tone="muted"
                  style={{ fontSize: rem(FONT.label), textDecorationLine: 'underline' }}
                >
                  {M.abandon}
                </Txt>
              </Press>
            ) : null}
          </PopSheet>
        ) : null}

        {st.history.length ? (
          <Card gap={4} testID="manager-history">
            <Txt v="h2">{M.history}</Txt>
            {st.history.map((h) => (
              <Txt key={h.n} style={small}>
                {h.clubId && h.club
                  ? M.historyRow({ n: h.n, club: tn(h.club), rank: h.rank, teams: h.teams })
                  : M.historyRest({ n: h.n })}
              </Txt>
            ))}
          </Card>
        ) : null}
        {!sheetLabel ? (
          <Btn kind="danger" testID="manager-abandon" onPress={askAbandon}>
            {st.phase === 'done' ? M.undo : M.abandon}
          </Btn>
        ) : null}
      </>
    ) : null;

  return (
    <Screen
      footer={
        bar && !sheetLabel ? (
          // T-11-329 선수 커리어의 '다음 →'처럼 진행 버튼은 화면 아래에 고정한다.
          <ActionBar>
            <Btn block kind="primary" testID={bar.act} disabled={busy} onPress={onBar}>
              {`${bar.label} →`}
            </Btn>
          </ActionBar>
        ) : undefined
      }
    >
      <Topbar />
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Txt v="eyebrow">{M.eyebrow}</Txt>
        <Txt v="h1" accessibilityRole="header">
          {M.title}
        </Txt>
      </View>

      {loginNeeded ? (
        <Card gap={10}>
          <Txt tone="muted">{M.loginNeeded}</Txt>
          <LoginButtons />
        </Card>
      ) : failed && !data ? (
        <Card gap={10}>
          <Txt tone="muted">{M.loadFail}</Txt>
          <Btn sm onPress={() => setRetryN((n) => n + 1)}>
            {M.retry}
          </Btn>
        </Card>
      ) : !data ? (
        <Skeleton height={240} />
      ) : (
        <>
          {play ?? (
            <Card gap={10} testID="manager-start">
              <Txt v="h2">{M.startHeading}</Txt>
              <Txt tone="muted" style={small}>
                {M.startLead}
              </Txt>
              {data.candidates.length ? (
                data.candidates.map((cand) => (
                  <Row
                    key={cand.careerId}
                    title={managerName(cand, local)}
                    sub={`${tn(POS_LABEL[cand.pos])} · OVR ${cand.peak}${
                      cand.inLineup ? ` · ${M.inLineup}` : ''
                    }${cand.listed ? ` · ${M.listed}` : ''}`}
                    action={
                      <Btn sm testID="manager-pick" disabled={busy} onPress={() => askStart(cand)}>
                        {M.pick}
                      </Btn>
                    }
                  />
                ))
              ) : (
                <Txt tone="muted" style={small} testID="manager-empty">
                  {M.noCandidates}
                </Txt>
              )}
              {errLine}
            </Card>
          )}

          <Card gap={10} testID="manager-list">
            <Txt v="h2">{M.myManagers}</Txt>
            {data.managers.length ? (
              <Txt tone="muted" style={small}>
                {M.effectNote}
              </Txt>
            ) : null}
            {!data.hasTeam && data.managers.length ? (
              <Txt tone="muted" style={small}>
                {M.needTeam}
              </Txt>
            ) : null}
            {data.managers.length ? (
              data.managers.map((m) => {
                const r = m.result!;
                const seated = data.coachId === m.careerId;
                return (
                  <View
                    key={m.id}
                    testID={`manager-card-${m.careerId}`}
                    style={{
                      gap: 6,
                      padding: 12,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: c.line,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt bold>{nameOf(m)}</Txt>
                      <Txt bold tone="accent">
                        {M.grade({ grade: r.grade })}
                      </Txt>
                      {seated ? (
                        <Txt tone="muted" bold style={tiny}>
                          {M.coachNow}
                        </Txt>
                      ) : null}
                    </View>
                    <Txt style={small}>
                      {`${endingName(r.ending)} · ${M.seasons({ n: r.seasons })} · ${M.honors({
                        titles: r.titles,
                        cups: r.cups,
                        promotions: r.promotions,
                      })}`}
                    </Txt>
                    <CardBody r={r} />
                    {/* 감독 칸 버튼은 왼쪽, T-11-345 경질은 오른쪽 끝에 한 줄로. */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      {data.hasTeam ? (
                        <Btn
                          sm
                          kind={seated ? 'default' : 'primary'}
                          testID={seated ? 'manager-unseat' : 'manager-seat'}
                          disabled={busy}
                          onPress={() => void seat(seated ? null : m.careerId)}
                        >
                          {seated ? M.unseat : M.seat}
                        </Btn>
                      ) : null}
                      <Btn
                        sm
                        kind="danger"
                        testID="manager-release"
                        disabled={busy}
                        style={{ marginLeft: 'auto' }}
                        onPress={() => askRelease(m)}
                      >
                        {M.release}
                      </Btn>
                    </View>
                  </View>
                );
              })
            ) : (
              <Txt tone="muted" style={small}>
                {M.noManagers}
              </Txt>
            )}
            {released ? (
              <Txt tone="muted" style={small} testID="manager-released">
                {released}
              </Txt>
            ) : null}
            {play && st?.phase !== 'done' ? errLine : null}
          </Card>
        </>
      )}
    </Screen>
  );
}
