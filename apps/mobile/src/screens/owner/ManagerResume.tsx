// T-11-338 진행 중인 감독 커리어 이어 하기(홈 · 내 구단 맨 위, 웹 ui/ManagerResume.svelte). 기기 세이브만 읽고 서버는
// 부르지 않는다. 세이브가 없으면 아무것도 그리지 않는다.
import { useMemo } from 'react';
import { View } from 'react-native';
import { managerResume } from '@offside/app-core/managerResume';
import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
import { tn } from '@offside/game/i18n/names';
import { go } from '../../game/nav';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Card, Press, Txt } from '../../ui';

export function ManagerResume() {
  const c = useColors();
  const r = useMemo(() => managerResume(), []);
  if (!r) return null;
  const line = r.done
    ? MG.resumeDone
    : r.club
      ? MG.resumeLine({ club: tn(r.club), n: r.n, total: r.total })
      : MG.resumeOffers({ n: r.n, total: r.total });
  return (
    <Press
      testID="manager-resume"
      accessibilityRole="button"
      accessibilityLabel={MG.resumeAria({ name: r.name ?? MG.resumeNoName })}
      onPress={() => go('manager')}
      scale={0.98}
    >
      <Card gap={12} style={{ borderWidth: 1, borderColor: c.accent }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt v="eyebrow">{MG.resumeEyebrow}</Txt>
            <Txt v="h2">{MG.resumeTitle}</Txt>
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              {r.name ? `${r.name} · ${line}` : line}
            </Txt>
          </View>
          <Txt tone="muted" style={{ fontSize: rem(1.5) }}>
            ›
          </Txt>
        </View>
      </Card>
    </Press>
  );
}
