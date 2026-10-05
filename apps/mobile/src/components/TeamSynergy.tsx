// T-11-105 팀 시너지 — 켜진 듀오·팀 색깔·주발 맞춤과 시너지 표(웹 team/TeamSynergy.svelte와 같은 내용).
// 칩을 누르면 그라운드에서 그 선수들을 잇는다.
import { useState } from 'react';
import { View } from 'react-native';
import {
  DUO_LINE_CAP,
  DUO_TOTAL_CAP,
  synergyPower,
  type TeamSynergy as Synergy,
} from '@offside/contracts/owner-team';
import { SYNERGY_TABLE, synergyChips, synergyNote } from '@offside/app-core/teamOwner';
import { useColors } from '../theme/useColors';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function TeamSynergy({
  synergy,
  season,
  focus,
  setFocus,
}: {
  synergy: Synergy;
  season: number;
  focus: string | null;
  setFocus: (id: string | null) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const power = synergyPower(synergy);
  const chips = synergyChips(synergy);
  return (
    <View testID="team-synergy" style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <Txt v="h3">
          팀 시너지{power > 0 ? <Txt v="h3" tone="accent">{` +${power}`}</Txt> : null}
        </Txt>
        <Txt v="xs" tone="muted">
          {synergyNote(season)}
        </Txt>
      </View>
      {chips.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((s) => {
            const on = focus === s.id;
            return (
              <Press
                key={s.id}
                testID={`synergy-${s.id}`}
                accessibilityLabel={`${s.name} · ${s.effect}`}
                accessibilityState={{ selected: on }}
                onPress={() => setFocus(on ? null : s.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: on ? 2 : 1,
                  borderStyle: s.badge ? 'dashed' : 'solid',
                  borderColor: on ? c.accent : c.line,
                  backgroundColor: c.surface2,
                }}
              >
                <Txt v="sm" bold>
                  {s.name}
                </Txt>
                <Txt v="xs" tone="muted">
                  {s.effect}
                </Txt>
              </Press>
            );
          })}
        </View>
      ) : (
        <Txt v="sm" tone="muted">
          아직 켜진 시너지가 없어요. 유형이 맞는 선수를 함께 세워 보세요.
        </Txt>
      )}
      <Press
        testID="synergy-table"
        onPress={() => setOpen(!open)}
        style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
      >
        <Txt v="sm" bold tone="accent">
          시너지 표 {open ? '접기' : '보기'}
        </Txt>
      </Press>
      {open ? (
        <View style={{ gap: 8 }}>
          {SYNERGY_TABLE.map(([name, desc, effect]) => (
            <View key={name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt v="sm" bold>
                  {name}
                </Txt>
                <Txt v="xs" tone="accent">
                  {effect}
                </Txt>
              </View>
              <Txt v="xs" tone="muted">
                {desc}
              </Txt>
            </View>
          ))}
          <Txt v="xs" tone="muted">
            듀오 효과는 줄마다 +{DUO_LINE_CAP}, 합쳐서 +{DUO_TOTAL_CAP}까지. 유스 선수는 시너지에
            들지 않아요.
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
