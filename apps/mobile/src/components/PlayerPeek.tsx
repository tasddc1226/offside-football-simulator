import { useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSnapshot } from 'valtio';
import { DETAIL_LABEL, slotFit } from '@offside/contracts/owner-team';
import type { DetailPos } from '@offside/contracts/positions';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { tn } from '@offside/game/i18n/names';
import { typeName } from '@offside/game/data';
import { cardBody } from '@offside/app-core/format';
import { prefs } from '../store';
import { Btn, Txt } from '../ui';
import { Toast } from '../ui/Toast';
import { chatText as LC } from '@offside/app-core/i18n/ko/chat';
import { cardEnhanceText as CE } from '@offside/app-core/i18n/ko/cardEnhance';
import {
  CARD_BODY_ROW,
  CARD_HEIGHT,
  CARD_SPECIAL_ROW,
  CARD_STYLE_ROW,
  PlayerCard,
} from './PlayerCard';
import { specialRibbon } from '@offside/app-core/cardSpecial';

export type PeekOrigin = { x: number; y: number; w: number; h: number };
/** 그라운드(measureInWindow 값) 위 자리 카드가 화면에서 놓인 곳 — 자리 카드는 62×88, 가운데가 자리 좌표(TeamPitch). */
export const pitchPeekOrigin = (
  px: number,
  py: number,
  w: number,
  h: number,
  pos: { x: number; y: number },
): PeekOrigin => ({ x: px + (pos.x / 100) * w - 31, y: py + (pos.y / 100) * h - 44, w: 62, h: 88 });
// 라커룸 카드(2열 중 한 칸)와 같은 폭·높이로 그려 글자·여백 비율을 같게 두고, 통째로 키운다.
const CARD_W = 165;
// PlayerCard 큰 카드 높이(플레이스타일 줄 · 키 몸무게 줄이 있으면 그만큼 더).
const cardHeight = (p: TeamPlayer) =>
  CARD_HEIGHT +
  (typeName(p.pos, p.type) ? CARD_STYLE_ROW : 0) +
  (cardBody(p) ? CARD_BODY_ROW : 0) +
  (specialRibbon(p.specials, p.daily) ? CARD_SPECIAL_ROW : 0);

/** 그라운드 카드를 누르면 그 자리에서 커져 라커룸 카드를 그대로 확대해 보여 준다. 닫으면 제자리로 돌아간다(웹 PlayerPeek). */
export function PlayerPeek({
  player,
  name,
  rating,
  slot,
  origin,
  onclose,
  onshare,
  onenhance,
}: {
  player: TeamPlayer;
  name: string;
  rating: number;
  /** 그라운드의 자리. 라운지처럼 자리가 없는 곳에서는 안 준다. */
  slot?: DetailPos;
  origin: PeekOrigin;
  onclose: () => void;
  /** 내 팀 그라운드에서만 준다. 라운지에 이 선수를 올린다. */
  onshare?: ((careerId: string) => void) | undefined;
  /** 내 팀 그라운드에서 강화할 수 있을 때만 준다. 모달을 겹치지 않게 닫은 뒤에 부른다. */
  onenhance?: ((player: TeamPlayer) => void) | undefined;
}) {
  const { motionOK } = useSnapshot(prefs);
  const { width, height } = useWindowDimensions();
  const CARD_H = cardHeight(player);
  const zoom = Math.max(1, Math.min(1.45, (width - 40) / CARD_W, (height - 220) / CARD_H));
  const t = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const holder = useRef<View>(null);
  const [box, setBox] = useState<PeekOrigin | null>(null);
  const closing = useRef(false);
  // 카드가 그라운드 카드 자리·크기에서 출발한다(FLIP). 가운데를 기준으로 커지므로 가운데끼리 잇는다.
  const from = box
    ? {
        dx: origin.x + origin.w / 2 - (box.x + box.w / 2),
        dy: origin.y + origin.h / 2 - (box.y + box.h / 2),
        scale: origin.w / CARD_W,
      }
    : { dx: 0, dy: 0, scale: zoom };
  function close(after?: () => void) {
    if (closing.current) return;
    closing.current = true;
    const done = () => {
      onclose();
      after?.();
    };
    if (!motionOK) return done();
    Animated.timing(t, {
      toValue: 0,
      duration: 200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(done);
  }
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => close()}
    >
      <Animated.View
        // 카드 아래 설명 줄 뒤로 화면 글자가 비치지 않게 일반 시트보다 어둡게 깐다.
        style={{ position: 'absolute', inset: 0, backgroundColor: '#000000c4', opacity: t }}
      >
        <Pressable
          testID="peek-backdrop"
          accessibilityLabel={L.close}
          onPress={() => close()}
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
                careerId: player.careerId,
                look: player.look,
                nation: player.nation,
                season: player.season,
                rating: player.peak,
                number: player.number,
                legendScore: player.legendScore,
                specials: player.specials,
                daily: player.daily,
                attrs: player.attrs,
                attrsEstimated: player.attrsEstimated,
                height: player.height,
                weight: player.weight,
                foot: player.foot,
                cardValue: player.cardValue,
                enhance: player.enhance,
                locked: player.locked,
                pos: player.pos,
                type: player.type,
                youth: false,
              }}
              code={player.dpos ?? player.pos}
            />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', gap: 14, opacity: t }}>
          {slot ? (
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Txt v="sm" bold style={{ color: '#fff' }}>
                {tn(DETAIL_LABEL[slot])}
              </Txt>
              <Txt v="xs" style={{ color: '#fff', opacity: 0.9, textAlign: 'center' }}>
                {L.pitchRatingFull({
                  peak: player.peak,
                  rating,
                  fit: Math.round(slotFit(slot, player, rating) * 100),
                })}
              </Txt>
            </View>
          ) : null}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}
          >
            {onenhance && player.cardValue != null ? (
              <Btn
                sm
                kind="primary"
                testID="player-enhance"
                onPress={() => close(() => onenhance(player))}
              >
                {CE.go}
              </Btn>
            ) : null}
            {onshare ? (
              <Btn
                sm
                kind="primary"
                testID="player-lounge-share"
                onPress={() => onshare(player.careerId)}
              >
                {LC.sharePlayerAct}
              </Btn>
            ) : null}
            <Btn sm onPress={() => close()}>
              {L.close}
            </Btn>
          </View>
        </Animated.View>
      </View>
      {/* 모달은 앱 위 별도 층이라 알림을 이 안에서도 그린다. */}
      <Toast />
    </Modal>
  );
}
