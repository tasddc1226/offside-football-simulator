// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte). 열 때 상태를 한 번 받고, 시도는 서버가 판정한다. 결과는 1초쯤 보여 주고
// 건너뛸 수 있다(움직임 줄이기면 바로).
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { TeamPlayer } from '@offside/app-core/api/team';
import {
  enhanceCard,
  fetchEnhanceState,
  type EnhanceResponse,
  type EnhanceStateResponse,
} from '@offside/app-core/api/cardEnhance';
import { enhanceErrorText, enhanceResultText, enhanceView } from '@offside/app-core/cardEnhance';
import { fundsText } from '@offside/app-core/funds';
import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
import { TeamDialog } from '../../components/TeamDialog';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { Btn, Txt } from '../../ui';

export function EnhanceSheet({
  player,
  name,
  close,
  onResult,
}: {
  player: TeamPlayer;
  name: string;
  close: () => void;
  onResult: (r: EnhanceResponse) => void;
}) {
  const c = useColors();
  const [info, setInfo] = useState<EnhanceStateResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<EnhanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState({
    enhance: player.enhance ?? 0,
    enhanceFails: player.enhanceFails ?? 0,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function load() {
    setStatus('loading');
    const r = await fetchEnhanceState();
    if (!r.ok) return setStatus('error');
    setInfo(r.data);
    setStatus('ready');
  }
  useEffect(() => {
    void load();
    return () => clearTimeout(timer.current);
  }, []);

  const view = info
    ? enhanceView(card, info.rules, info.balance, info.used, !!player.listing)
    : null;
  const settle = () => {
    clearTimeout(timer.current);
    setRolling(false);
  };

  async function go() {
    if (!view || view.block || view.cost === null || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await enhanceCard(player.careerId, view.level, view.cost);
    setBusy(false);
    if (!r.ok) {
      setError(enhanceErrorText(r.error));
      if (r.error.reason === 'ENHANCE_STALE') void load();
      return;
    }
    setCard({ enhance: r.data.to, enhanceFails: r.data.fails });
    setInfo((s) => (s ? { ...s, balance: r.data.balance, used: r.data.used } : s));
    setResult(r.data);
    onResult(r.data);
    if (prefs.motionOK) {
      setRolling(true);
      timer.current = setTimeout(settle, 1000);
    }
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
    <TeamDialog title={L.title} close={close}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Txt bold style={{ flexShrink: 1 }}>
          {name}
        </Txt>
        <Txt bold style={{ color: c.accentText, fontSize: 20 }} testID="enhance-level">
          {`+${card.enhance}`}
        </Txt>
      </View>
      {status === 'loading' ? (
        <Txt tone="muted">…</Txt>
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
            {cell(L.cost, view.costText, 'enhance-cost')}
            {cell(L.balance, fundsText(info.balance), 'enhance-balance')}
          </View>
          {view.next !== null ? (
            <Txt v="sm" tone="muted">
              {view.failText}
            </Txt>
          ) : null}
          {view.pityText ? (
            <Txt v="sm" tone="muted">
              {view.pityText}
            </Txt>
          ) : null}
          {view.effectText ? (
            <Txt v="sm" tone="muted">
              {view.effectText}
            </Txt>
          ) : null}
          {rolling ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: c.accent }} />
              <Btn sm kind="ghost" onPress={settle}>
                {L.skip}
              </Btn>
            </View>
          ) : result ? (
            <Txt
              bold
              tone={result.success ? 'good' : 'ink'}
              testID={`enhance-result-${result.success ? 'success' : 'fail'}`}
            >
              {enhanceResultText(result)}
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
            disabled={busy || rolling || !!view.block}
            onPress={() => void go()}
            testID="enhance-go"
          >
            {busy ? L.going : L.go}
          </Btn>
          <Txt v="xs" tone="muted">
            {`${view.leftText} · ${L.effectNote}`}
          </Txt>
        </>
      )}
    </TeamDialog>
  );
}
