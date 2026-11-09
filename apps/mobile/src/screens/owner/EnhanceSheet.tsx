// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte). 열 때 그 카드 상태를 한 번 받고, 시도는 서버가 판정한다. 응답을 받지 못한
// 시도는 같은 멱등 키로 다시 보내 두 번 판정되지 않는다. 결과는 열린 카드(careerId)에만 돌려준다.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { TeamPlayer } from '@offside/app-core/api/team';
import {
  enhanceCard,
  enhanceCardAuto,
  fetchEnhanceState,
  type EnhanceResponse,
  type EnhanceStateResponse,
} from '@offside/app-core/api/cardEnhance';
import {
  ENHANCE_CHARGE_MS,
  enhanceAutoBudgets,
  enhanceAutoExpected,
  enhanceAutoSummary,
  enhanceAutoTargets,
  enhanceErrorText,
  enhanceKeepKey,
  enhanceResultKind,
  enhanceResultText,
  enhanceTitleText,
  enhanceView,
  runEnhanceAuto,
  type EnhanceAutoRun,
} from '@offside/app-core/cardEnhance';
import { fmtValue } from '@offside/app-core/format';
import { fundsText } from '@offside/app-core/funds';
import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
import { EnhanceFx } from '../../components/EnhanceFx';
import { EnhanceStage } from '../../components/EnhanceStage';
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
  const [target, setTarget] = useState(0);
  const [budgetPick, setBudgetPick] = useState(0);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoStopAsked, setAutoStopAsked] = useState(false);
  const [autoRun, setAutoRun] = useState<EnhanceAutoRun | null>(null);
  const [autoTarget, setAutoTarget] = useState(0);
  const stopRef = useRef(false);

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
    };
  }, []);

  const view = info ? enhanceView(info.card, info.rules, info.balance, listed) : null;
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
    if (!info || !view?.body || busy || autoBusy || !budgetNow || !targetNow) return;
    setAutoBusy(true);
    setAutoStopAsked(false);
    stopRef.current = false;
    setError(null);
    setResult(null);
    setAutoRun(null);
    setAutoTarget(targetNow);
    const from = info.card.level;
    const run = await runEnhanceAuto({
      start: info.card,
      target: targetNow,
      budget: budgetNow,
      balance: info.balance,
      send: (body, key) => enhanceCardAuto(careerId, body, key),
      newKey: () => crypto.randomUUID(),
      cancelled: () => stopRef.current,
      onChunk: (r) => {
        if (!alive.current) return;
        setAutoRun({ ...r });
        setInfo((s) => (s ? { ...s, balance: r.balance, card: r.card } : s));
      },
    });
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
    setInfo((s) => (s ? { ...s, balance: run.balance, card: run.card } : s));
    if (run.stop === 'error') void load();
  }

  async function go() {
    if (!view?.body || busy) return;
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

  return (
    <TeamDialog
      title={L.title}
      close={close}
      overlay={<EnhanceFx charging={busy} result={result} />}
    >
      <EnhanceStage
        name={name}
        level={info?.card.level ?? player.enhance ?? 0}
        charging={busy}
        kind={result ? enhanceResultKind(result) : null}
        text={result ? enhanceResultText(result) : ''}
      />
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
            disabled={busy || autoBusy || !view.body}
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
                  <Txt v="xs" tone="muted">
                    {L.autoBudget}
                  </Txt>
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
                      disabled={busy || !view.body || !budgetNow}
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
            {[`${L.balance} ${fundsText(info.balance)}`, L.effectNote].join('\n')}
          </Txt>
        </>
      )}
    </TeamDialog>
  );
}
