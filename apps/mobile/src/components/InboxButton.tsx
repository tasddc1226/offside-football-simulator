import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { inboxState, openInbox } from '../platform/inbox';
import { useColors } from '../theme/useColors';
import { Press, Txt } from '../ui';

/** 홈에서 서버를 조회하지 않는다. 마지막 알림함 조회의 미읽음 수를 표시한다. */
export function InboxButton() {
  const { unreadCount } = useSnapshot(inboxState);
  const c = useColors();
  return (
    <Press
      onPress={() => openInbox()}
      testID="inbox-open"
      accessibilityLabel={unreadCount ? `알림함, 읽지 않은 알림 ${unreadCount}개` : '알림함'}
      style={{
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 12,
      }}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
          fill="none"
          stroke={c.ink}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {unreadCount ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            backgroundColor: c.accent,
            borderRadius: 10,
            minWidth: 20,
            paddingHorizontal: 4,
            alignItems: 'center',
          }}
        >
          <Txt accessible={false} style={{ color: c.accentInk, fontSize: 12, fontWeight: '700' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Txt>
        </View>
      ) : null}
    </Press>
  );
}
