import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { gameCenterText as L } from '@offside/app-core/i18n/ko/gameCenter';
import { enterGameCenter, gameCenter } from '../platform/gameCenter';
import {
  finishGameCenterOffers,
  takeGameCenterOffer,
  type GameCenterOfferPlace,
} from '../platform/gameCenterOffer';
import { useColors } from '../theme/useColors';
import { Btn } from '../ui/Btn';
import { Card } from '../ui/Card';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function GameCenterEntry({
  place,
  eligible = true,
}: {
  place: GameCenterOfferPlace | 'hof';
  eligible?: boolean;
}) {
  const state = useSnapshot(gameCenter);
  const c = useColors();
  const [open, setOpen] = useState(false);
  const permanent = place === 'hof';
  useEffect(() => {
    if (place === 'hof') return;
    if (takeGameCenterOffer(place, eligible && state.available && !state.connected)) setOpen(true);
  }, [place, eligible, state.available, state.connected]);
  if (!state.available || (!permanent && (!open || (state.connected && !state.error)))) return null;

  const android = Platform.OS === 'android';
  const service = android ? L.playTitle : L.title;
  const needsConnection = !state.connected || state.error === 'changed' || state.error === 'signIn';
  const error = state.error
    ? state.error === 'signIn'
      ? android
        ? L.playSignIn
        : L.signIn
      : L[state.error]
    : null;
  const id = `game-services-${place}`;
  return (
    <Card testID={id} gap={12}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Txt bold accessibilityRole="header">
            {permanent ? service : place === 'retire' ? L.offerRetireTitle : L.offerHomeTitle}
          </Txt>
          <Txt v="sm" tone="muted">
            {L.offerBody({ service })}
          </Txt>
        </View>
        {!permanent ? (
          <Press
            testID={`${id}-dismiss`}
            accessibilityLabel={L.dismissOffer}
            disabled={state.busy}
            scale={1}
            onPress={() => {
              finishGameCenterOffers();
              setOpen(false);
            }}
            style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
              <Path
                d="m6 6 12 12M18 6 6 18"
                stroke={c.muted}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </Press>
        ) : null}
      </View>
      {error ? (
        <Txt v="sm" tone="bad" accessibilityLiveRegion="polite" testID={`${id}-error`}>
          {error}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn
          testID={`${id}-leaderboard`}
          kind="tonal"
          disabled={state.busy}
          accessibilityState={{ busy: state.busy }}
          style={{ flexGrow: 1, flexBasis: 128 }}
          onPress={() => void enterGameCenter('leaderboard')}
        >
          {state.busy ? L.opening : needsConnection ? L.connectLeaderboard : L.leaderboard}
        </Btn>
        {permanent ? (
          <Btn
            testID={`${id}-achievements`}
            disabled={state.busy}
            accessibilityState={{ busy: state.busy }}
            style={{ flexGrow: 1, flexBasis: 128 }}
            onPress={() => void enterGameCenter('achievements')}
          >
            {state.busy ? L.opening : needsConnection ? L.connectAchievements : L.achievements}
          </Btn>
        ) : null}
      </View>
    </Card>
  );
}
