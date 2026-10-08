import { useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSnapshot } from 'valtio';
import { DETAIL_LABEL, slotFit } from '@offside/contracts/owner-team';
import type { DetailPos } from '@offside/contracts/positions';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { tn } from '@offside/game/i18n/names';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Btn, Txt } from '../ui';
import { PlayerCard } from './PlayerCard';

export type PeekOrigin = { x: number; y: number; w: number; h: number };
const CARD_W = 220;

/** 그라운드 카드를 누르면 그 자리에서 커져 라커룸 카드처럼 능력치까지 보여 준다. 닫으면 제자리로 돌아간다(웹 PlayerPeek). */
export function PlayerPeek({
  player,
  name,
  rating,
  slot,
  origin,
  onclose,
}: {
  player: TeamPlayer;
  name: string;
  rating: number;
  slot: DetailPos;
  origin: PeekOrigin;
  onclose: () => void;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const [box, setBox] = useState<PeekOrigin | null>(null);
  const closing = useRef(false);
  const fit = Math.round(slotFit(slot, player, rating) * 100);
  // 카드가 그라운드 카드 자리·크기에서 출발한다(FLIP).
  const from = box
    ? {
        dx: origin.x + origin.w / 2 - (box.x + box.w / 2),
        dy: origin.y + origin.h / 2 - (box.y + box.h / 2),
        scale: origin.w / box.w,
      }
    : { dx: 0, dy: 0, scale: 1 };
  function close() {
    if (closing.current) return;
    closing.current = true;
    if (!motionOK) return onclose();
    Animated.timing(t, {
      toValue: 0,
      duration: 200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => onclose());
  }
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View
        style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim, opacity: t }}
      >
        <Pressable
          testID="peek-backdrop"
          accessibilityLabel={L.close}
          onPress={close}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View
        pointerEvents="box-none"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <Animated.View
          testID="player-peek"
          accessibilityViewIsModal
          accessibilityLabel={L.peekAria({ name })}
          onLayout={(e) => {
            if (box) return;
            const l = e.nativeEvent.layout;
            // 가운데 정렬이라 화면 기준 자리는 창 크기에서 바로 나온다.
            setBox({ x: (width - l.width) / 2, y: (height - l.height) / 2, w: l.width, h: l.height });
            if (motionOK)
              Animated.spring(t, {
                toValue: 1,
                speed: 16,
                bounciness: 6,
                useNativeDriver: true,
              }).start();
          }}
          style={{
            width: CARD_W,
            alignItems: 'center',
            gap: 14,
            opacity: box ? 1 : 0,
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.dx, 0] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.dy, 0] }) },
              { scale: t.interpolate({ inputRange: [0, 1], outputRange: [from.scale, 1] }) },
            ],
          }}
        >
          <View style={{ width: '100%' }}>
            <PlayerCard
              cell={{
                name,
                nation: player.nation,
                season: player.season,
                rating,
                peak: player.peak,
                number: player.number,
                legendScore: player.legendScore,
                attrs: player.attrs,
                attrsEstimated: player.attrsEstimated,
                cardValue: player.cardValue,
                pos: player.pos,
                youth: false,
              }}
              code={slot}
            />
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Txt v="sm" bold style={{ color: '#fff' }}>
              {tn(DETAIL_LABEL[slot])}
            </Txt>
            <Txt v="xs" style={{ color: '#fff', opacity: 0.9, textAlign: 'center' }}>
              {L.pitchRatingFull({ peak: player.peak, rating, fit })}
            </Txt>
          </View>
          <Btn sm onPress={close}>
            {L.close}
          </Btn>
        </Animated.View>
      </View>
    </Modal>
  );
}
