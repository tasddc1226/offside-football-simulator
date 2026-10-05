import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  playerNudge,
  takePlayerNudge,
  notePlayerVisit,
  PLAYER_NUDGE_DELAY,
  PLAYER_NUDGE_MS,
  type PlayerNudge as Notice,
} from '@offside/app-core/player-nudge';
import { peekOpen } from '@offside/app-core/potential-peek';
import type { GameState } from '@offside/game/types';
import { potPeek, peekAvailable } from '../../platform/rewardedPeek';
import { sheetState } from '../../store';
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
    let hide: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      if (!takePlayerNudge(candidate)) return;
      setShown(candidate);
      hide = setTimeout(() => setShown(null), PLAYER_NUDGE_MS);
    }, PLAYER_NUDGE_DELAY);
    return () => {
      clearTimeout(timer);
      clearTimeout(hide);
    };
  }, [key, title, text, tab, open, busy, active]);
  if (!shown || !active || open || busy || !n || tab !== 'season') return null;
  return (
    <View
      testID="player-nudge"
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: c.accent,
        borderRadius: 12,
        backgroundColor: c.surface,
        gap: 8,
      }}
    >
      <View accessibilityLiveRegion="polite">
        <Txt style={{ fontWeight: '700' }}>{shown.title}</Txt>
        <Txt style={{ fontSize: 13, lineHeight: 20, marginTop: 4 }}>{shown.text}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn
            block
            onPress={() => {
              setShown(null);
              openPlayer();
            }}
          >
            선수 탭 보기
          </Btn>
        </View>
        <Btn accessibilityLabel="선수 탭 안내 닫기" onPress={() => setShown(null)}>
          닫기
        </Btn>
      </View>
    </View>
  );
}
