// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte). 열 때 그 카드 상태를 한 번 받고, 시도는 서버가 판정한다. 응답을 받지 못한
// 시도는 같은 멱등 키로 다시 보내 두 번 판정되지 않는다. 결과는 열린 카드(careerId)에만 돌려준다.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { TeamPlayer } from '@offside/app-core/api/team';
import {
  enhanceCard,
  fetchEnhanceState,
  type EnhanceResponse,
  type EnhanceStateResponse,
} from '@offside/app-core/api/cardEnhance';
import {
  ENHANCE_CHARGE_MS,
  enhanceErrorText,
  enhanceKeepKey,
  enhanceResultKind,
  enhanceResultText,
  enhanceTitleText,
  enhanceView,
} from '@offside/app-core/cardEnhance';
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
    };
  }, []);

  const view = info ? enhanceView(info.card, info.rules, info.balance, listed) : null;

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
            disabled={busy || !view.body}
            onPress={() => void go()}
            testID="enhance-go"
          >
            {busy ? L.going : L.go}
          </Btn>
          <Txt v="xs" tone="muted">
            {[`${L.balance} ${fundsText(info.balance)}`, L.effectNote].join('\n')}
          </Txt>
        </>
      )}
    </TeamDialog>
  );
}
