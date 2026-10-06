// T-11-128 구단주 허브의 '시즌 결산' 카드(웹 Owner.svelte의 결산 카드) — 끝난 시즌이 있으면 가장 최근 결산을 한 줄로
// 알리고 결산 화면으로 연다. 끝난 시즌이 없거나 불러오지 못하면 카드를 그리지 않는다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchSeasonRecap } from '@offside/app-core/api/seasonRecap';
import type { SeasonRecapResponse } from '@offside/contracts';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { recapCardView, type HonorView } from '@offside/app-core/seasonRecap';
import { MEDAL_GLOW, useMedal } from '../../components/Laurel';
import { go } from '../../game/nav';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { Btn, Card, Pill, Row, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';

/** 휘장 한 줄 알약 — 메달 색(1위 금 · 상위 10 은 · 그 밖 동). */
export function HonorChip({ h }: { h: HonorView }) {
  const { text } = useMedal(h.medal);
  return (
    <View
      testID={`recap-chip-${h.kind}`}
      style={{
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 9,
        borderWidth: 1,
        borderColor: alpha(MEDAL_GLOW[h.medal], 0.6),
        backgroundColor: alpha(MEDAL_GLOW[h.medal], 0.14),
      }}
    >
      <Txt style={{ fontSize: rem(0.75), fontWeight: '700', color: text }}>{h.chip}</Txt>
    </View>
  );
}

export function RecapCard() {
  const [recap, setRecap] = useState<SeasonRecapResponse | null>(null);
  const { tick, track } = useRefresh();
  useEffect(() => {
    let alive = true;
    void track(fetchSeasonRecap()).then((r) => alive && r.ok && setRecap(r.data));
    return () => {
      alive = false;
    };
  }, [tick, track]);
  if (!recap) return null;

  const { line, chips, isNew } = recapCardView(recap);
  return (
    <Card gap={12} testID="owner-recap">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt v="eyebrow">Season recap</Txt>
          <Row gap={6}>
            <Txt v="h2" accessibilityRole="header">
              {L.cardTitle}
            </Txt>
            {isNew ? (
              <View testID="recap-new">
                <Pill tone="good">{L.newBadge}</Pill>
              </View>
            ) : null}
          </Row>
          <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
            {line}
          </Txt>
        </View>
        <Btn testID="recap" onPress={() => go('recap')}>
          {L.open}
        </Btn>
      </View>
      {chips.length > 0 ? (
        <Row gap={6}>
          {chips.map((h) => (
            <HonorChip key={`${h.season}-${h.kind}`} h={h} />
          ))}
        </Row>
      ) : null}
    </Card>
  );
}
