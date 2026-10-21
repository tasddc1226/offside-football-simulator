// 명예의 전당 이름 공개 토글(웹 PublishCard.svelte, T-10-005). 은퇴 때는 환경설정 '선수 이름 공개'(T-10-065, 기본 켜짐)를 따른다.
// T-11-439 공개 중에도 실명 경고를 한 줄 두고(B4), 서버가 받지 않을 이름이면 누르기 전에 알리고 버튼을 막는다(B3).
import { canPublishName } from '@offside/app-core/namePublic';
import { useState } from 'react';
import { View } from 'react-native';
import type { HofEntry } from '@offside/game/types';
import { setLegendPublic } from '../../game/host';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { liveEntry } from './own';
import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';

export function PublishCard({ h }: { h: HofEntry }) {
  // 쓰기 가능한 파생 상태: 다른 곳(결번 안내의 '이름 공개')에서 h.public이 바뀌면 그 값으로 다시 맞춘다.
  const [prev, setPrev] = useState(h.public);
  const [on, setOn] = useState(!!h.public);
  if (prev !== h.public) {
    setPrev(h.public);
    setOn(!!h.public);
  }

  const blocked = !on && !canPublishName(h.name);

  function toggle() {
    if (setLegendPublic(liveEntry(h), !on)) setOn(!on);
  }

  return (
    <Card>
      <View>
        <Txt v="eyebrow">Hall of Fame</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.publishTitle}
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        {L.publishBefore}{' '}
        <Txt v="sm" tone="muted" bold>
          {on ? L.publishNamed({ name: h.name }) : L.publishAnon}
        </Txt>{' '}
        {L.publishAfter}
        {!on && !blocked ? ` ${L.publishHint}` : ''}
      </Txt>
      {on ? (
        <Txt v="sm" testID="publish-warn">
          {L.publishWarn}
        </Txt>
      ) : null}
      {blocked ? (
        <Txt v="sm" testID="publish-blocked">
          {L.publishBlocked}
        </Txt>
      ) : null}
      <Btn
        block
        testID="hof-public"
        disabled={blocked}
        accessibilityLabel={on ? L.publishRevert : L.publishOn}
        onPress={toggle}
      >
        {on ? L.publishRevert : L.publishOn}
      </Btn>
    </Card>
  );
}
