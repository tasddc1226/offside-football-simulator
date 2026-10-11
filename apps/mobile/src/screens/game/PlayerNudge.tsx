import { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import {
  playerNudge,
  takePlayerNudge,
  notePlayerVisit,
  PLAYER_NUDGE_DELAY,
  type PlayerNudge as Notice,
} from '@offside/app-core/player-nudge';
import { peekOpen } from '@offside/app-core/potential-peek';
import { playerNudgeText as L } from '@offside/app-core/i18n/ko/playerNudge';
import type { GameState } from '@offside/game/types';
import { potPeek, peekAvailable } from '../../platform/rewardedPeek';
import { prefs, sheetState } from '../../store';
import { useColors } from '../../theme/useColors';
import { Txt } from '../../ui/Txt';
import { Btn } from '../../ui/Btn';

export function PlayerNudge({
  s,
  tab,
  openPlayer,
  onVisibility,
}: {
  s: GameState;
  tab: string;
  openPlayer: () => void;
  onVisibility: (visible: boolean) => void;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const insets = useSafeAreaInsets();
  const { open, busy } = useSnapshot(sheetState);
  const peek = useSnapshot(potPeek);
  const n = playerNudge(s, peekAvailable() && !peekOpen(s, peek.peek));
  const [shown, setShown] = useState<Notice | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    onVisibility(!!shown && active && !open && !busy && !!n && tab === 'season');
    return () => onVisibility(false);
  }, [shown, active, open, busy, n?.key, tab, onVisibility]);
  const key = n?.key,
    title = n?.title,
    text = n?.text;
  useEffect(() => {
    const candidate = key && title && text ? { key, title, text } : null;
    if (tab === 'player') notePlayerVisit(candidate);
    setShown(null);
    if (!candidate || !active || tab !== 'season' || open || busy) return;
    const timer = setTimeout(() => {
      if (takePlayerNudge(candidate)) setShown(candidate);
    }, PLAYER_NUDGE_DELAY);
    return () => clearTimeout(timer);
  }, [key, title, text, tab, open, busy, active]);
  if (!shown || !active || open || busy || !n || tab !== 'season') return null;
  const close = () => setShown(null);
  // T-11-212 아래에서 올라오는 시트(웹은 가운데 대화창). 저절로 닫히지 않고, 버튼·바깥 누르기·뒤로로 닫는다.
  return (
    <Modal
      visible
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel={L.closeAria}
          onPress={close}
          style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }}
        />
        <View
          testID="player-nudge"
          accessibilityViewIsModal
          style={{
            padding: 20,
            paddingBottom: 20 + insets.bottom,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: c.surface,
            gap: 16,
          }}
        >
          <View>
            <Txt style={{ fontWeight: '700', fontSize: 17, textAlign: 'center' }}>
              {shown.title}
            </Txt>
            <Txt style={{ fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: 'center' }}>
              {shown.text}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Btn
                block
                kind="primary"
                onPress={() => {
                  close();
                  openPlayer();
                }}
              >
                {L.open}
              </Btn>
            </View>
            <Btn accessibilityLabel={L.closeAria} onPress={close}>
              {L.close}
            </Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}
