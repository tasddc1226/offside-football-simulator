import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { CupMatch } from '@offside/app-core/api/cup';
import {
  createCupPredictionController,
  emptyCupPredictions,
  predictionOpen,
  predictionChoices,
  predictionPercentages,
  type CupPredictionContext,
} from '@offside/app-core/cupPredictions';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { Card, Btn, Txt, Press } from '../../ui';
import { DISPLAY, rem } from '../../theme/type';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';

export function usePredictions(
  cupId: string | undefined,
  accountId: string | null,
  matches: readonly CupMatch[] | undefined,
) {
  const [state, setState] = useState(emptyCupPredictions);
  const [now, setNow] = useState(Date.now);
  const controller = useMemo(() => createCupPredictionController(setState), []);
  useEffect(() => {
    if (cupId) void controller.load(cupId, accountId !== null);
    return () => controller.cancel();
  }, [controller, cupId, accountId]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      const current = Date.now();
      setNow(current);
      const next = matches
        ?.filter((m) => !m.played && Date.parse(m.at) > current)
        .map((m) => Date.parse(m.at))
        .sort((a, b) => a - b)[0];
      if (next) timer = setTimeout(advance, Math.min(2_147_483_647, next - current + 10));
    };
    advance();
    return () => clearTimeout(timer);
  }, [matches]);
  return { state, now, controller };
}

export function PredictionIntro({
  prediction,
  retry,
}: {
  prediction: CupPredictionContext;
  retry: () => void;
}) {
  const s = prediction.state;
  return (
    <Card gap={8} testID="cup-prediction-intro">
      <Txt v="h2">{L.predictionTitle}</Txt>
      {[L.predictionIntro, L.predictionSaved, L.predictionKnockout].map((text) => (
        <View key={text} style={{ flexDirection: 'row', gap: 8 }}>
          <Txt v="sm" tone="muted">
            ·
          </Txt>
          <Txt v="sm" style={{ flex: 1 }}>
            {text}
          </Txt>
        </View>
      ))}
      {s.status === 'loading' ? (
        <Txt v="sm" tone="muted">
          {L.predictionLoading}
        </Txt>
      ) : null}
      {s.status === 'error' || s.personalFailed ? (
        <>
          <Txt tone="warn">{L.predictionFail}</Txt>
          <Btn onPress={retry}>{L.predictionRetry}</Btn>
        </>
      ) : null}
    </Card>
  );
}
export function CupPrediction({
  m,
  prediction,
}: {
  m: CupMatch;
  prediction: CupPredictionContext;
}) {
  const c = useColors();
  const s = prediction.state;
  const mine = s.mine[m.id];
  const counts = s.counts[m.id];
  const shares = predictionPercentages(counts);
  const open = predictionOpen(m, prediction.now);
  const choices = predictionChoices(m);
  const label = (k: 'home' | 'away' | 'draw') =>
    k === 'draw' ? L.predictionDraw : k === 'home' ? L.predictionHome : L.predictionAway;
  const note =
    s.busy === m.id
      ? L.predictionSaving
      : mine?.correct === true
        ? `${L.predictionHit} · ${mine.rewarded ? L.predictionRewarded : L.predictionPending}`
        : mine?.correct === false
          ? L.predictionMiss
          : !open
            ? mine
              ? L.predictionPending
              : m.played
                ? ''
                : L.predictionClosed
            : !counts || counts.home + counts.draw + counts.away === 0
              ? L.predictionEmpty
              : '';
  return (
    <View style={{ gap: 8, paddingBottom: 14 }} testID={`cup-prediction-${m.id}`}>
      {s.status === 'ready' && m.homeTeamId && m.awayTeamId ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            <Txt v="sm" bold>
              {L.predictionShares}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {choices.map((k) => {
              const selected = mine?.pick === k;
              const ink = selected ? c.accentInk : c.ink;
              return (
                <Press
                  key={k}
                  accessibilityLabel={`${label(k)} ${shares[k]}% · ${selected ? L.predictionSelected : open ? L.predictionPick : L.predictionClosed}`}
                  accessibilityState={{
                    selected,
                    disabled: !open || !prediction.linked || !!s.busy || s.personalFailed,
                  }}
                  disabled={!open || !prediction.linked || !!s.busy || s.personalFailed}
                  onPress={() => prediction.pick(m.id, k)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 112,
                    gap: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: selected ? c.accent : c.line,
                    borderRadius: 12,
                    backgroundColor: selected ? c.accent : c.surface2,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                    }}
                  >
                    <Txt v="xs" bold style={{ color: ink }}>
                      {label(k)}
                    </Txt>
                    <View
                      accessible={false}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        borderWidth: 1,
                        borderColor: selected ? ink : c.muted,
                        backgroundColor: selected ? ink : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected ? (
                        <Txt style={{ fontSize: 10, lineHeight: 12, color: c.accent }}>✓</Txt>
                      ) : null}
                    </View>
                  </View>
                  <Txt
                    num
                    bold
                    style={{ fontFamily: DISPLAY[700], fontSize: rem(1.75), color: ink }}
                  >
                    {shares[k]}
                    <Txt v="xs" style={{ color: ink }}>
                      {' '}
                      %
                    </Txt>
                  </Txt>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 3,
                      overflow: 'hidden',
                      backgroundColor: selected ? alpha(ink, 0.18) : c.line,
                    }}
                  >
                    <View
                      style={{
                        width: `${shares[k]}%`,
                        height: 4,
                        backgroundColor: selected ? ink : c.muted,
                      }}
                    />
                  </View>
                  {selected || (open && prediction.linked) ? (
                    <Txt v="xs" bold style={{ color: selected ? ink : c.muted }}>
                      {selected ? L.predictionSelected : L.predictionPick}
                    </Txt>
                  ) : null}
                </Press>
              );
            })}
          </View>
          {note ? (
            <Txt v="xs" tone="muted" accessibilityLiveRegion="polite">
              {note}
            </Txt>
          ) : null}
        </>
      ) : null}
      {s.errorMatch === m.id ? (
        <Txt tone="warn" accessibilityRole="alert">
          {s.error}
        </Txt>
      ) : null}
    </View>
  );
}
