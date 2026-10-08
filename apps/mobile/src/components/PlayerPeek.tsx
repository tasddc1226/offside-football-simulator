import { useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSnapshot } from 'valtio';
import { DETAIL_LABEL, slotFit } from '@offside/contracts/owner-team';
import type { DetailPos } from '@offside/contracts/positions';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { tn } from '@offside/game/i18n/names';
import { typeName } from '@offside/game/data';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Btn, Txt } from '../ui';
import { CARD_HEIGHT, CARD_STYLE_ROW, PlayerCard } from './PlayerCard';

export type PeekOrigin = { x: number; y: number; w: number; h: number };
// 라커룸 카드(2열 중 한 칸)와 같은 폭·높이로 그려 글자·여백 비율을 같게 두고, 통째로 키운다.
const CARD_W = 165;
// PlayerCard 큰 카드 높이(플레이스타일 줄이 있으면 그만큼 더).
const cardHeight = (p: TeamPlayer) => CARD_HEIGHT + (typeName(p.pos, p.type) ? CARD_STYLE_ROW : 0);

/** 그라운드 카드를 누르면 그 자리에서 커져 라커룸 카드를 그대로 확대해 보여 준다. 닫으면 제자리로 돌아간다(웹 PlayerPeek). */
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
  const CARD_H = cardHeight(player);
  const zoom = Math.max(1, Math.min(1.45, (width - 40) / CARD_W, (height - 220) / CARD_H));
  const t = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const holder = useRef<View>(null);
  const [box, setBox] = useState<PeekOrigin | null>(null);
  const closing = useRef(false);
  const fit = Math.round(slotFit(slot, player, rating) * 100);
  // 카드가 그라운드 카드 자리·크기에서 출발한다(FLIP). 가운데를 기준으로 커지므로 가운데끼리 잇는다.
  const from = box
    ? {
        dx: origin.x + origin.w / 2 - (box.x + box.w / 2),
        dy: origin.y + origin.h / 2 - (box.y + box.h / 2),
        scale: origin.w / CARD_W,
      }
    : { dx: 0, dy: 0, scale: zoom };
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
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 }}
      >
        <View
          ref={holder}
          testID="player-peek"
          accessibilityViewIsModal
          accessibilityLabel={L.peekAria({ name })}
          collapsable={false}
          onLayout={() => {
            if (box) return;
            holder.current?.measureInWindow((x, y, w, h) => {
              setBox({ x, y, w, h });
              if (motionOK)
                Animated.spring(t, {
                  toValue: 1,
                  speed: 16,
                  bounciness: 6,
                  useNativeDriver: true,
                }).start();
            });
          }}
          style={{
            width: CARD_W * zoom,
            height: CARD_H * zoom,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={{
              width: CARD_W,
              opacity: box ? 1 : 0,
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.dx, 0] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.dy, 0] }) },
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [from.scale, zoom] }) },
              ],
            }}
          >
            {/* 라커룸 카드와 같은 내용(최고 OVR·본래 포지션). 이 자리에서의 값은 카드 아래 줄에. */}
            <PlayerCard
              cell={{
                name,
                nation: player.nation,
                season: player.season,
                rating: player.peak,
                number: player.number,
                legendScore: player.legendScore,
                attrs: player.attrs,
                attrsEstimated: player.attrsEstimated,
                cardValue: player.cardValue,
                pos: player.pos,
                type: player.type,
                youth: false,
              }}
              code={player.dpos ?? player.pos}
            />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', gap: 14, opacity: t }}>
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
