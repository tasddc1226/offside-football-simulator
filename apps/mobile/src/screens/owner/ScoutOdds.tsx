// T-11-196 프리미엄 스카우트 확률 공개표(웹 cup/ScoutOdds.svelte). 펼칠 때만 계산한다.
import { useState } from 'react';
import { View } from 'react-native';
import { detailOpenNow } from '@offside/app-core/state';
import { scoutOddsRows } from '@offside/app-core/scoutOdds';
import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Txt } from '../../ui';

export function ScoutOdds() {
  const [open, setOpen] = useState(false);
  const c = useColors();
  const small = { fontSize: rem(0.8125) };
  return (
    <View style={{ gap: 8 }}>
      <Btn sm kind="ghost" testID="scout-odds" onPress={() => setOpen((o) => !o)}>
        {open ? L.oddsHide : L.oddsShow}
      </Btn>
      {open ? (
        <View
          style={{ gap: 8, padding: 12, borderRadius: 10, backgroundColor: c.surface2 }}
          testID="scout-odds-table"
        >
          <Txt style={{ ...small, fontWeight: '700' }}>{L.oddsTitle}</Txt>
          {scoutOddsRows(detailOpenNow()).map((r) => (
            <View key={r.label} style={{ gap: 2 }}>
              <Txt tone="muted" style={small}>
                {r.label}
              </Txt>
              <Txt style={{ ...small, fontVariant: ['tabular-nums'] }}>
                {r.cells.map((x) => `${x.grade} ${x.pct}`).join('   ')}
              </Txt>
            </View>
          ))}
          <Txt tone="muted" style={small}>
            {L.oddsNote}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
