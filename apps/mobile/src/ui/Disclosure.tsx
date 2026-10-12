// T-11-221 펼침 행 공통(웹 .disc-row · .disc-chev) — 제목은 왼쪽, 오른쪽 끝에 셰브론(접힘 ⌄, 펼침 ⌃).
// 행 전체가 눌리고 높이 48 이상. 다른 내용을 왼쪽에 두는 카드형 트리거는 Chevron만 가져다 쓴다.
import type { ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../theme/useColors';
import { Press } from './Press';
import { Txt } from './Txt';

export function Chevron({ open, size = 18 }: { open: boolean; size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
        stroke={c.muted}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DisclosureRow({
  open,
  onToggle,
  label,
  testID,
  border = true,
}: {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  testID?: string;
  /** 위쪽 구분선(기본 있음). */
  border?: boolean;
}) {
  const c = useColors();
  return (
    <Press
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      testID={testID}
      style={{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderTopWidth: border ? 1 : 0,
        borderTopColor: c.line,
      }}
    >
      <Txt bold style={{ flex: 1 }}>
        {label}
      </Txt>
      <Chevron open={open} />
    </Press>
  );
}
