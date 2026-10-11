import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { PlayerManagement } from '@offside/app-core/playerManagement';
import {
  releaseLock,
  releaseAmount,
  releaseValue,
  releaseConfirmText,
  fundsText,
} from '@offside/app-core/market';
import { localCareerNames } from '@offside/game/hof-store';
import { playerName } from '@offside/app-core/format';
import { marketText as M } from '@offside/app-core/i18n/ko/market';
import { ownerPlayersText as L } from '@offside/app-core/i18n/ko/ownerPlayers';
import { openPublicLegendById } from '../../game/host';
import { Btn, Card, Press, Txt } from '../../ui';
import { useColors } from '../../theme/useColors';

export function PlayerRelease({ season }: { season: number }) {
  const manager = useMemo(() => new PlayerManagement(), []);
  const [state, setState] = useState(manager.state);
  const local = useMemo(() => localCareerNames(), []);
  const c = useColors();
  useEffect(() => {
    const unsub = manager.subscribe(setState);
    void manager.load(season);
    return () => {
      unsub();
      manager.dispose();
    };
  }, [manager, season]);
  const selected = manager.selectedPlayers;
  const amount = releaseAmount(selected, state.rate);
  const nameOf = (p: (typeof state.players)[number]) =>
    local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  return (
    <View style={{ gap: 12 }} testID="player-management">
      <Txt tone="muted">{M.releaseIntro}</Txt>
      {state.notice ? (
        <Txt accessibilityLiveRegion="polite" tone="good">
          {state.notice}
        </Txt>
      ) : null}
      {state.error ? (
        <>
          <Txt accessibilityRole="alert">{state.error}</Txt>
          <Btn disabled={state.busy} onPress={() => void manager.load(season)}>
            {L.retry}
          </Btn>
        </>
      ) : null}
      {state.loading ? (
        <Txt>{L.loading}</Txt>
      ) : (
        <>
          <Btn
            testID="players-pick-all"
            disabled={state.busy || state.confirm || !manager.eligible.length}
            onPress={() => manager.selectAll()}
          >
            {state.selected.size ? M.pickNone : L.pickLimit}
          </Btn>
          {state.players.length ? (
            state.players.map((p) => {
              const locked = releaseLock(p, state.lineup);
              return (
                <View
                  key={p.careerId}
                  testID={`managed-player-${p.careerId}`}
                  style={{ gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line }}
                >
                  <Press
                    accessibilityRole="checkbox"
                    accessibilityLabel={M.releasePickLabel({ name: nameOf(p) })}
                    accessibilityState={{
                      checked: state.selected.has(p.careerId),
                      disabled: !!locked || state.busy || state.confirm,
                    }}
                    disabled={!!locked || state.busy || state.confirm}
                    onPress={() => manager.toggle(p.careerId)}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: locked ? c.muted : c.good,
                          backgroundColor: state.selected.has(p.careerId) ? c.good : 'transparent',
                        }}
                      />
                      <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
                        <Txt bold>{nameOf(p)}</Txt>
                        <Txt tone="muted">
                          {locked ?? M.releaseInfo({ score: String(p.legendScore ?? 0) })}
                        </Txt>
                        {!locked ? <Txt>{fundsText(releaseValue(p, state.rate))}</Txt> : null}
                      </View>
                    </View>
                  </Press>
                  <Btn
                    sm
                    testID={`player-detail-${p.careerId}`}
                    disabled={state.busy}
                    onPress={() => void openPublicLegendById(p.careerId)}
                  >
                    {L.viewRecord}
                  </Btn>
                </View>
              );
            })
          ) : (
            <Txt tone="muted">{L.noOwned}</Txt>
          )}
          {selected.length ? (
            <Card gap={12} testID="player-release-summary">
              <Txt bold>{`${M.dockSum({ n: selected.length })} · ${fundsText(amount)}`}</Txt>
              {state.confirm ? (
                <>
                  <Txt>{releaseConfirmText(selected.length, amount)}</Txt>
                  <View style={{ gap: 8 }}>
                    <Btn disabled={state.busy} onPress={() => manager.confirm(false)}>
                      {M.close}
                    </Btn>
                    <Btn
                      kind="danger"
                      testID="players-release-confirm"
                      disabled={state.busy}
                      onPress={() => void manager.release()}
                    >
                      {M.releaseBtn({ n: selected.length })}
                    </Btn>
                  </View>
                </>
              ) : (
                <>
                  <Txt tone="muted">{M.dockWarn}</Txt>
                  <Btn
                    kind="danger"
                    testID="players-release"
                    disabled={state.busy}
                    onPress={() => manager.confirm(true)}
                  >
                    {M.releaseBtn({ n: selected.length })}
                  </Btn>
                </>
              )}
            </Card>
          ) : null}
        </>
      )}
    </View>
  );
}
