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
import { synergyTable, synergyChips, synergyNote } from '@offside/app-core/teamOwner';
import { teamSynergyText as L } from '@offside/app-core/i18n/ko/teamSynergy';
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
          {L.title}
          {power > 0 ? <Txt v="h3" tone="accent">{` +${power}`}</Txt> : null}
        </Txt>
        <Txt v="xs" tone="muted">
          {synergyNote(season)}
        </Txt>
      </View>
      {chips.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((s) => {
            const on = focus === s.id;
            const state = on ? L.chipViewing : s.applied ? L.chipApplied : null;
            return (
              <Press
                key={s.id}
                testID={`synergy-${s.id}`}
                accessibilityLabel={`${s.name} · ${s.effect}${state ? ` · ${state}` : ''}`}
                accessibilityState={{ selected: on }}
                onPress={() => setFocus(on ? null : s.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: s.badge ? 'dashed' : 'solid',
                  // 켜진 시너지는 모두 같은 '적용 중' 모습 — 누른 칩은 고른 것처럼 보이지 않게 배경만 바꾸고 '보는 중'을 단다.
                  borderColor: s.applied ? `${c.accent}80` : c.line,
                  backgroundColor: on ? `${c.accent}2e` : c.surface2,
                }}
              >
                <View>
                  <Txt v="sm" bold>
                    {s.applied ? (
                      <Txt v="sm" bold tone="accent">
                        {'✓ '}
                      </Txt>
                    ) : null}
                    {s.name}
                  </Txt>
                  <Txt v="xs" tone="muted">
                    {s.effect}
                  </Txt>
                </View>
                {state ? (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? c.accent : `${c.accent}80`,
                      backgroundColor: on ? c.accent : 'transparent',
                    }}
                  >
                    <Txt
                      v="xs"
                      bold
                      style={{ fontSize: 10, color: on ? c.accentInk : c.accentText }}
                    >
                      {state}
                    </Txt>
                  </View>
                ) : null}
              </Press>
            );
          })}
        </View>
      ) : null}
      {chips.length ? (
        <Txt v="xs" tone="muted">
          {L.chipHint}
        </Txt>
      ) : (
        <Txt v="sm" tone="muted">
          {L.empty}
        </Txt>
      )}
      <Press
        testID="synergy-table"
        onPress={() => setOpen(!open)}
        style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
      >
        <Txt v="sm" bold tone="accent">
          {L.tableToggle({ open })}
        </Txt>
      </Press>
      {open ? (
        <View style={{ gap: 8 }}>
          {synergyTable().map(([name, desc, effect]) => (
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
            {L.capNote({ line: DUO_LINE_CAP, total: DUO_TOTAL_CAP })}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
