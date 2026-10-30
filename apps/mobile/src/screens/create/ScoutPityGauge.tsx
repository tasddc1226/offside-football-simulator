// T-11-415 프리미엄 스카우트 천장 막대(웹 ui/ScoutPityGauge.svelte). S 확정 · 특급 S 두 칸에 쌓인 장수를 보인다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
import { scoutPityAt, scoutPityGauge, scoutPityView, type ScoutPity } from '@offside/contracts/cup';
import { View } from 'react-native';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Pill, Txt } from '../../ui';

export function ScoutPityGauge({ pity, empty }: { pity: ScoutPity; empty?: boolean }) {
  const c = useColors();
  const small = { fontSize: rem(FONT.label) };
  const g = scoutPityGauge(pity);
  const v = scoutPityView(pity);
  const rows = [
    { key: 'sure', label: L.pillSure, aria: L.pitySure({ n: v.sureIn }), ...g.sure },
    { key: 'elite', label: L.gaugeElite, aria: L.pityElite({ n: v.eliteIn }), ...g.elite },
  ];
  return (
    <View
      style={{ gap: 10, padding: 12, borderRadius: RADIUS.sm, backgroundColor: c.surface2 }}
      testID="candidate-scout-pity"
    >
      <Txt style={{ ...small, fontWeight: '700' }}>{L.pityTitle}</Txt>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 4 }} testID={`scout-pity-${r.key}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt style={small}>{r.label}</Txt>
            {r.next ? <Pill tone="good">{L.gaugeNext}</Pill> : null}
            <Txt
              tone="muted"
              style={{ ...small, marginLeft: 'auto', fontVariant: ['tabular-nums'] }}
            >
              {L.gaugeCount({ have: r.have, need: r.need })}
            </Txt>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={r.aria}
            accessibilityValue={{ min: 0, max: r.need, now: r.have }}
            style={{
              height: 8,
              borderRadius: RADIUS.pill,
              overflow: 'hidden',
              backgroundColor: c.line,
            }}
          >
            <View
              style={{
                width: `${(r.have / r.need) * 100}%`,
                height: '100%',
                borderRadius: RADIUS.pill,
                backgroundColor: r.next ? c.good : c.accent,
              }}
            />
          </View>
        </View>
      ))}
      <Txt tone="muted" style={small}>
        {L.pityHelp(scoutPityAt())}
      </Txt>
      {empty ? (
        <Txt tone="muted" style={small} testID="scout-pity-keep">
          {L.pityKeep}
        </Txt>
      ) : null}
    </View>
  );
}
