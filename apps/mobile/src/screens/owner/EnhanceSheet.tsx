// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte). 열 때 그 카드 상태를 한 번 받고, 시도는 서버가 판정한다. 응답을 받지 못한
// 시도는 같은 멱등 키로 다시 보내 두 번 판정되지 않는다. 결과는 열린 카드(careerId)에만 돌려준다.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { TeamPlayer } from '@offside/app-core/api/team';
import {
  enhanceCard,
  enhanceCardAuto,
  fetchEnhanceState,
  fetchEnhanceStats,
  type EnhanceResponse,
  type EnhanceStateResponse,
  type EnhanceStatsResponse,
} from '@offside/app-core/api/cardEnhance';
import {
  ENHANCE_CHARGE_MS,
  enhanceAutoBudgets,
  enhanceAutoExpected,
  enhanceAutoFinal,
  enhanceAutoHoldMs,
  enhanceAutoSummary,
  enhanceAutoTickMs,
  enhanceAutoTargets,
  enhanceEffectText,
  enhanceErrorText,
  enhanceKeepKey,
  enhanceResultKind,
  enhanceResultText,
  enhanceStatsNow,
  enhanceTitleText,
  enhanceView,
  runEnhanceAuto,
  type EnhanceAutoRun,
} from '@offside/app-core/cardEnhance';
import { fmtValue } from '@offside/app-core/format';
import { fundsText } from '@offside/app-core/funds';
import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
import { EnhanceFx } from '../../components/EnhanceFx';
import { goFairness } from '../../game/nav';
import { EnhanceStage, type EnhanceRoll } from '../../components/EnhanceStage';
import { TeamDialog } from '../../components/TeamDialog';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { Btn, Skeleton, Txt } from '../../ui';

export function EnhanceSheet({
  player,
  name,
  close,
  onResult,
}: {
  player: TeamPlayer;
  name: string;
  close: () => void;
  /** 성공 · 실패 모두 — 그 카드의 새 단계. */
  onResult: (careerId: string, r: EnhanceResponse) => void;
}) {
  const c = useColors();
  // 열 때의 카드로 고정한다(창이 열린 동안 부모가 다른 카드를 골라도 이 창은 이 카드만 다룬다).
  const [careerId] = useState(player.careerId);
  const [listed] = useState(!!player.listing);
  const [info, setInfo] = useState<EnhanceStateResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnhanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef(crypto.randomUUID());
  const alive = useRef(true);
  // T-11-679 자동 강화 — 목표 단계 · 쓸 금액을 고르면 서버가 연달아 판정한다. 창을 닫으면 다음 묶음을 보내지 않는다.
  const [autoOpen, setAutoOpen] = useState(false);
  // T-11-758 지금 확률의 실제 성공률 한 줄. 창을 열 때 한 번 받고 6시간 메모라 다시 열어도 또 부르지 않는다. 못 받으면 줄만 빠진다.
  const [statsData, setStatsData] = useState<EnhanceStatsResponse | null>(null);
  useEffect(() => {
    void fetchEnhanceStats().then((r) => {
      if (alive.current && r.ok) setStatsData(r.data);
    });
  }, []);
  const [target, setTarget] = useState(0);
  const [budgetPick, setBudgetPick] = useState(0);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoStopAsked, setAutoStopAsked] = useState(false);
  const [autoRun, setAutoRun] = useState<EnhanceAutoRun | null>(null);
  const [autoTarget, setAutoTarget] = useState(0);
  const stopRef = useRef(false);
  // T-11-682 자동 강화 연출: 서버가 묶음으로 판정한 시도를 단계 숫자로 차례로 되감아 보여 주고, 끝나면 시작 → 끝 단계를 강화 한 번
  // 결과처럼 전체 화면 연출로 보여 준다(웹 EnhanceSheet.svelte와 같다). 동작 줄이기면 되감기 없이 결과 문구만 남는다.
  const [shown, setShown] = useState<number | null>(null);
  const [roll, setRoll] = useState<EnhanceRoll | null>(null);
  // T-11-757 자동 강화 결과 연출은 터치를 통과시킨다. 연출을 보며 화면을 누르다 강화가 나가지 않게 잠깐 버튼을 막는다.
  const [held, setHeld] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const r = await fetchEnhanceState(careerId);
    if (!alive.current) return;
    if (!r.ok) {
      setStatus((s) => (s === 'ready' ? s : 'error'));
      return;
    }
    setInfo(r.data);
    setStatus('ready');
  }
  useEffect(() => {
    void load();
    return () => {
      alive.current = false;
      stopRef.current = true;
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const view = info ? enhanceView(info.card, info.rules, info.balance, listed) : null;
  const statsNow =
    statsData && view && view.next !== null ? enhanceStatsNow(statsData, view.rateBp) : null;
  const targets = info ? enhanceAutoTargets(info.card.level) : [];
  const targetNow = targets.includes(target) ? target : (targets[0] ?? 0);
  const expected = info && targetNow ? enhanceAutoExpected(info.card, targetNow, info.rules) : 0;
  const budgets =
    info && view?.cost
      ? enhanceAutoBudgets(expected, info.balance, view.cost)
      : { list: [], pick: 0 };
  const budgetNow = budgets.list.some((b) => b.value === budgetPick) ? budgetPick : budgets.pick;
  const autoText = autoRun && !autoBusy ? enhanceAutoSummary(autoRun, autoTarget) : null;

  async function startAuto() {
    if (!info || !view?.body || busy || autoBusy || held || !budgetNow || !targetNow) return;
    setAutoBusy(true);
    setAutoStopAsked(false);
    stopRef.current = false;
    setError(null);
    setResult(null);
    setAutoRun(null);
    setAutoTarget(targetNow);
    const from = info.card.level;
    const target = targetNow;
    const started = Date.now();
    const motion = prefs.motionOK;
    const span = Math.max(1, target - from);
    let replay: Promise<void> = Promise.resolve();
    let n = 0;
    let trail: EnhanceRoll['trail'] = [];
    const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
    if (motion) {
      setShown(from);
      setRoll({ pct: 0, kind: null, n: 0, trail: [] });
    }
    const run = await runEnhanceAuto({
      start: info.card,
      target: targetNow,
      budget: budgetNow,
      balance: info.balance,
      send: (body, key) => enhanceCardAuto(careerId, body, key),
      newKey: () => crypto.randomUUID(),
      cancelled: () => stopRef.current,
      onChunk: (r, tries) => {
        if (!alive.current) return;
        setAutoRun({ ...r });
        if (motion && tries.length) {
          const ms = enhanceAutoTickMs(tries.length);
          replay = replay.then(async () => {
            for (const t of tries) {
              if (!alive.current) return;
              const kind = enhanceResultKind(t);
              trail = [...trail.slice(-23), kind];
              n += 1;
              setShown(t.to);
              setRoll({ pct: Math.max(0, Math.min(1, (t.to - from) / span)), kind, n, trail });
              await sleep(ms);
            }
          });
        }
        setInfo((s) => (s ? { ...s, balance: r.balance, card: r.card } : s));
      },
    });
    // 되감기를 다 보여 준 뒤(짧게 끝나도 게이지 한 번 길이는 채운 뒤) 결과를 연다.
    await replay;
    const wait = motion && run.tries ? ENHANCE_CHARGE_MS - (Date.now() - started) : 0;
    if (wait > 0 && alive.current) await sleep(wait);
    // 창을 닫은 뒤에 끝나도 그 카드에는 반영한다.
    if (run.tries)
      onResult(careerId, {
        success: run.card.level > from,
        from,
        to: run.card.level,
        cost: run.spent,
        balance: run.balance,
        card: run.card,
        ...(run.titles.length ? { titles: run.titles } : {}),
      });
    if (!alive.current) return;
    setAutoRun(run);
    setAutoBusy(false);
    setShown(null);
    setRoll(null);
    setInfo((s) => (s ? { ...s, balance: run.balance, card: run.card } : s));
    if (run.tries) {
      const final = enhanceAutoFinal(run, from);
      setResult(final);
      setHeld(true);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => setHeld(false), enhanceAutoHoldMs(final));
    }
    if (run.stop === 'error') void load();
  }

  async function go() {
    if (!view?.body || busy || held) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const started = Date.now();
    const r = await enhanceCard(careerId, view.body, requestKey.current);
    if (!r.ok) {
      // 응답을 받지 못했으면 같은 키로 다시 보낸다(서버가 이미 판정했으면 그 결과가 온다). 거절이면 새 키로.
      if (!enhanceKeepKey(r.error)) requestKey.current = crypto.randomUUID();
      if (!alive.current) return;
      setBusy(false);
      setError(enhanceErrorText(r.error));
      if (r.error.reason === 'ENHANCE_STALE') void load();
      return;
    }
    requestKey.current = crypto.randomUUID();
    // 게이지가 다 찬 뒤 결과를 연다. 판정은 이미 끝났고 연출만 기다린다.
    const wait = prefs.motionOK ? ENHANCE_CHARGE_MS - (Date.now() - started) : 0;
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
    // 창을 닫은 뒤에 온 결과도 그 카드에는 반영한다.
    onResult(careerId, r.data);
    if (!alive.current) return;
    setBusy(false);
    setInfo((s) => (s ? { ...s, balance: r.data.balance, card: r.data.card } : s));
    setResult(r.data);
  }

  const cell = (label: string, value: string, testID: string) => (
    <View
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 10,
        padding: 8,
      }}
    >
      <Txt v="xs" tone="muted">
        {label}
      </Txt>
      <Txt bold num testID={testID}>
        {value}
      </Txt>
    </View>
  );

  // 자동 강화를 누를 때는 창이 아래로 내려가 있으므로, 되감기 동안 단계 칸을 창 위에 붙여 둔다.
  const pinStage = autoBusy && !!roll;
  const stage = (
    <EnhanceStage
      name={name}
      level={shown ?? info?.card.level ?? player.enhance ?? 0}
      charging={busy}
      roll={autoBusy ? roll : null}
      kind={result ? enhanceResultKind(result) : null}
      text={result ? enhanceResultText(result) : ''}
    />
  );

  return (
    <TeamDialog
      pinned={pinStage ? stage : null}
      title={L.title}
      close={close}
      overlay={<EnhanceFx charging={busy} result={result} />}
    >
      {pinStage ? null : stage}
      {status === 'loading' ? (
        <Skeleton height={180} />
      ) : status === 'error' || !view || !info ? (
        <>
          <Txt v="sm">{L.loadFail}</Txt>
          <Btn block onPress={() => void load()}>
            {L.retry}
          </Btn>
        </>
      ) : (
        <>
          {/* T-11-728 강화가 무엇을 바꾸는지 맨 위에 둔다(예전에는 창 맨 아래 자금 줄 밑에 있었다). */}
          <View
            testID="enhance-effect"
            style={{ gap: 2, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: c.line }}
          >
            {enhanceEffectText(view.level) ? (
              <Txt bold style={{ color: c.accentText }}>
                {enhanceEffectText(view.level)}
              </Txt>
            ) : null}
            <Txt v="sm" tone="muted">
              {L.effectNote}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cell(
              `${L.now} → ${L.next}`,
              view.next === null ? `+${view.level}` : `+${view.level} → +${view.next}`,
              'enhance-step',
            )}
            {cell(L.rate, view.next === null ? '-' : view.ratePct, 'enhance-rate')}
            {cell(L.keep, view.next === null ? '-' : view.keepPct, 'enhance-keep')}
            {cell(L.fail, view.next === null ? '-' : view.downPct, 'enhance-down')}
            {cell(L.cost, view.costText, 'enhance-cost')}
            {cell(L.fxLabel, view.fxText, 'enhance-fx')}
          </View>
          {view.ovrText ? (
            <Txt bold testID="enhance-ovr">
              {view.ovrText}
            </Txt>
          ) : null}
          {view.tierText ? (
            <Txt v="sm" tone="muted" testID="enhance-tier">
              {view.tierText}
            </Txt>
          ) : null}
          {view.failText ? (
            <Txt v="sm" tone="muted">
              {view.failText}
            </Txt>
          ) : null}
          <Txt v="xs" tone="muted">
            {statsNow ? (
              <Txt v="xs" tone="muted" testID="enhance-actual">{`${statsNow} `}</Txt>
            ) : null}
            <Txt
              v="xs"
              tone="muted"
              style={{ textDecorationLine: 'underline' }}
              accessibilityRole="link"
              testID="enhance-odds"
              onPress={() => {
                close();
                goFairness();
              }}
            >
              {`${L.statsMore} ›`}
            </Txt>
          </Txt>
          {result && enhanceTitleText(result.titles) ? (
            <Txt bold tone="good" testID="enhance-title">
              {enhanceTitleText(result.titles)}
            </Txt>
          ) : null}
          {error ? (
            <Txt v="sm" tone="warn">
              {error}
            </Txt>
          ) : null}
          {view.block ? (
            <Txt v="sm" tone="warn">
              {view.block}
            </Txt>
          ) : null}
          <Btn
            block
            kind="primary"
            disabled={busy || autoBusy || held || !view.body}
            onPress={() => void go()}
            testID="enhance-go"
          >
            {busy ? L.going : L.go}
          </Btn>
          {view.next !== null ? (
            <View
              testID="enhance-auto"
              style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 10, gap: 8 }}
            >
              <Btn
                sm
                kind="ghost"
                onPress={() => setAutoOpen(!autoOpen || autoBusy)}
                accessibilityState={{ expanded: autoOpen || autoBusy }}
                testID="enhance-auto-toggle"
              >
                {`${L.autoTitle} ${autoOpen || autoBusy ? '▲' : '▼'}`}
              </Btn>
              {autoOpen || autoBusy ? (
                <>
                  <Txt v="xs" tone="muted">
                    {L.autoTarget}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {targets.map((t) => (
                      <Btn
                        key={t}
                        sm
                        kind={t === targetNow ? 'accent' : 'ghost'}
                        disabled={autoBusy}
                        accessibilityState={{ selected: t === targetNow }}
                        onPress={() => setTarget(t)}
                        testID={`enhance-auto-target-${t}`}
                      >
                        {`+${t}`}
                      </Btn>
                    ))}
                  </View>
                  {budgets.list.length ? (
                    <Txt v="xs" tone="muted">
                      {L.autoBudget}
                    </Txt>
                  ) : null}
                  <View style={{ gap: 6 }}>
                    {budgets.list.map((b) => (
                      <Btn
                        key={b.value}
                        sm
                        kind={b.value === budgetNow ? 'accent' : 'ghost'}
                        disabled={autoBusy}
                        accessibilityState={{ selected: b.value === budgetNow }}
                        onPress={() => setBudgetPick(b.value)}
                        testID="enhance-auto-budget"
                      >
                        {b.label}
                      </Btn>
                    ))}
                  </View>
                  <Txt v="xs" tone="muted">
                    {[L.autoExpected({ value: fmtValue(expected) }), L.autoNote].join('\n')}
                  </Txt>
                  {autoBusy ? (
                    <>
                      <Txt bold testID="enhance-auto-progress">
                        {L.autoRunning({
                          n: autoRun?.tries ?? 0,
                          spent: fmtValue(autoRun?.spent ?? 0),
                        })}
                      </Txt>
                      <Btn
                        block
                        disabled={autoStopAsked}
                        onPress={() => {
                          stopRef.current = true;
                          setAutoStopAsked(true);
                        }}
                        testID="enhance-auto-stop"
                      >
                        {autoStopAsked ? L.autoStopping : L.autoStop}
                      </Btn>
                    </>
                  ) : (
                    <Btn
                      block
                      kind="primary"
                      disabled={busy || held || !view.body || !budgetNow}
                      onPress={() => void startAuto()}
                      testID="enhance-auto-go"
                    >
                      {L.autoStart}
                    </Btn>
                  )}
                  {autoText ? (
                    <Txt bold testID="enhance-auto-result">
                      {[autoText.done, autoText.why].filter(Boolean).join('\n')}
                    </Txt>
                  ) : null}
                  {!autoBusy && autoRun && enhanceTitleText(autoRun.titles) ? (
                    <Txt bold tone="good">
                      {enhanceTitleText(autoRun.titles)}
                    </Txt>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
          <Txt v="xs" tone="muted">
            {`${L.balance} ${fundsText(info.balance)}`}
          </Txt>
        </>
      )}
    </TeamDialog>
  );
}
