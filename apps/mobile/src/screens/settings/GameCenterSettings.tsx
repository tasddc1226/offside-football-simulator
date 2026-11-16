import { Platform, View } from 'react-native';
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
  const android = Platform.OS === 'android';
  const service = {
    title: android ? L.playTitle : L.title,
    body: android ? L.playBody : L.body,
    connect: android ? L.playConnect : L.connect,
    busy: android ? L.playBusy : L.busy,
    synced: android ? L.playSynced : L.synced,
    signIn: android ? L.playSignIn : L.signIn,
    disconnectHint: android ? L.playDisconnectHint : L.disconnectHint,
  };
  return (
    <SettingsCard gap={12}>
      <SettingsLabel title={service.title} muted={service.body} />
      {state.connected ? <Txt>{L.connected({ name: state.alias })}</Txt> : null}
      {state.error ? (
        <Txt tone="bad" accessibilityLiveRegion="polite" testID="game-center-error">
          {state.error === 'signIn' ? service.signIn : L[state.error]}
        </Txt>
      ) : state.synced ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {state.hasRecords ? service.synced : L.empty}
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
          {state.busy ? service.busy : state.error ? L.retry : service.connect}
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
            {state.busy ? service.busy : L.leaderboard}
          </Btn>
          {android ? (
            <Btn
              block
              disabled={state.busy}
              testID="game-center-weekly"
              onPress={() => void openGameCenter('weekly')}
            >
              {L.weekly}
            </Btn>
          ) : null}
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
          <Txt tone="muted">{service.disconnectHint}</Txt>
        </View>
      ) : null}
    </SettingsCard>
  );
}
