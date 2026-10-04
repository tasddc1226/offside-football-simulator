// 명예의 전당 이름 공개 토글(웹 PublishCard.svelte, T-10-005). 은퇴 때는 환경설정 '선수 이름 공개'(T-10-065, 기본 켜짐)를 따른다.
import { useState } from 'react';
import { View } from 'react-native';
import type { HofEntry } from '@offside/game/types';
import { setLegendPublic } from '../../game/host';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { liveEntry } from './own';

export function PublishCard({ h }: { h: HofEntry }) {
  // 쓰기 가능한 파생 상태: 다른 곳(결번 안내의 '이름 공개')에서 h.public이 바뀌면 그 값으로 다시 맞춘다.
  const [prev, setPrev] = useState(h.public);
  const [on, setOn] = useState(!!h.public);
  if (prev !== h.public) {
    setPrev(h.public);
    setOn(!!h.public);
  }

  function toggle() {
    if (setLegendPublic(liveEntry(h), !on)) setOn(!on);
  }

  return (
    <Card>
      <View>
        <Txt v="eyebrow">Hall of Fame</Txt>
        <Txt v="h2" accessibilityRole="header">
          전체 명예의 전당 이름 공개
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        은퇴 기록은 모든 유저가 보는 명예의 전당에 올라가요. 지금은{' '}
        <Txt v="sm" tone="muted" bold>
          {on ? `"${h.name}" 이름으로` : '익명으로'}
        </Txt>{' '}
        표시돼요.
        {!on
          ? ' 이름을 공개하면 다른 유저에게 선수 이름이 보여요. 실명은 쓰지 않는 게 좋아요.'
          : ''}
      </Txt>
      <Btn
        block
        testID="hof-public"
        accessibilityLabel={on ? '익명으로 되돌리기' : '이름 공개하기'}
        onPress={toggle}
      >
        {on ? '익명으로 되돌리기' : '이름 공개하기'}
      </Btn>
    </Card>
  );
}
