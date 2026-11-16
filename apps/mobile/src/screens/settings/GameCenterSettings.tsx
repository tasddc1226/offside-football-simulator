import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { gameCenterText as L } from '@offside/app-core/i18n/ko/gameCenter';
import { Btn, Txt } from '../../ui';
import {
  gameCenter,
  connectGameCenter,
  disconnectGameCenter,
  openGameCenter,
} from '../../platform/gameCenter';
import { SettingsCard, SettingsLabel } from './parts';

export function GameCenterSettings() {
  const state = useSnapshot(gameCenter);
  if (!state.available) return null;
  return (
    <SettingsCard gap={12}>
      <SettingsLabel title={L.title} muted={L.body} />
      {state.connected ? <Txt>{L.connected({ name: state.alias })}</Txt> : null}
      {state.error ? (
        <Txt tone="bad" accessibilityLiveRegion="polite" testID="game-center-error">
          {L[state.error]}
        </Txt>
      ) : state.synced ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {state.hasRecords ? L.synced : L.empty}
        </Txt>
      ) : null}
      {!state.connected || state.error ? (
        <Btn
          block
          kind="primary"
          disabled={state.busy}
          testID="game-center-connect"
          accessibilityState={{ busy: state.busy }}
          onPress={() => void connectGameCenter()}
        >
          {state.busy ? L.busy : state.error ? L.retry : L.connect}
        </Btn>
      ) : null}
      {state.connected ? (
        <View style={{ gap: 8 }}>
          <Btn
            block
            disabled={state.busy}
            testID="game-center-leaderboard"
            accessibilityState={{ busy: state.busy }}
            onPress={() => void openGameCenter('leaderboard')}
          >
            {state.busy ? L.busy : L.leaderboard}
          </Btn>
          <Btn
            block
            disabled={state.busy}
            testID="game-center-achievements"
            onPress={() => void openGameCenter('achievements')}
          >
            {L.achievements}
          </Btn>
          <Btn block kind="ghost" testID="game-center-disconnect" onPress={disconnectGameCenter}>
            {L.disconnect}
          </Btn>
          <Txt tone="muted">{L.disconnectHint}</Txt>
        </View>
      ) : null}
    </SettingsCard>
  );
}
