// 확률 도감의 접고 펴는 칸(웹 <details>)과 [용어, 설명] 목록 — 공통 규칙(Dex)·확률과 공정성(Fairness)이 같이 쓴다.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { rem } from '../../theme/type';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

const fs = rem(0.8125);
export const foldLine = { fontSize: fs, lineHeight: fs * 1.5 } as const;

export function Fold({
  title,
  open,
  onToggle,
  children,
  testID,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <Press
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        scale={0.99}
        style={{ minHeight: 32, justifyContent: 'center' }}
      >
        <Txt bold>
          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
            {open ? '▾ ' : '▸ '}
          </Txt>
          {title}
        </Txt>
      </Press>
      {open ? <View style={{ marginTop: 8, gap: 4 }}>{children}</View> : null}
    </View>
  );
}

export function Terms({ list }: { list: (readonly [string, string])[] }) {
  return (
    <>
      {list.map(([term, desc]) => (
        <View key={term} style={{ gap: 4 }}>
          <Txt bold style={[foldLine, { marginTop: 6 }]}>
            {term}
          </Txt>
          <Txt tone="muted" style={foldLine}>
            {desc}
          </Txt>
        </View>
      ))}
    </>
  );
}
