import { useState } from 'react';
import { View } from 'react-native';
import { POS, type Pos } from '@offside/game/data';
import { positionGuide } from '@offside/app-core/careerGuide';
import { careerGuideText as L } from '@offside/app-core/i18n/ko/careerGuide';
import { Txt } from '../../ui/Txt';
import { Press } from '../../ui/Press';
import { useColors } from '../../theme/useColors';
export function PositionGuide({ pos }: { pos: Pos }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Pos | null>(null);
  const current = chosen ?? pos;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
      <Press
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID="position-guide"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Txt>
          {L.guideTitle} {open ? '−' : '+'}
        </Txt>
      </Press>
      {open ? (
        <View style={{ gap: 12, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['FW', 'MF', 'DF', 'GK'] as const).map((p) => (
              <Press
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: current === p }}
                onPress={() => setChosen(p)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  justifyContent: 'center',
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: current === p ? c.pitch : c.surface2,
                }}
              >
                <Txt v="sm" bold style={{ color: current === p ? c.onPitch : c.ink }}>
                  {POS[p].label}
                </Txt>
              </Press>
            ))}
          </View>
          <Txt v="sm" tone="muted">
            {L.guideNote}
          </Txt>
          {positionGuide(current).map((e) => (
            <View
              key={e.id}
              style={{ padding: 10, gap: 4, borderWidth: 1, borderColor: c.line, borderRadius: 8 }}
            >
              <Txt style={{ fontWeight: '700' }}>{e.name}</Txt>
              <Txt v="sm" tone="muted">
                {e.desc}
              </Txt>
              <Txt v="sm">
                {L.focusLabel} · {e.focus}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
