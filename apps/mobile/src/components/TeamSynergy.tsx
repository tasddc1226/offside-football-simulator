// T-11-105 팀 시너지 — 규칙 전부를 적용 중 → 효과 없음 → 미적용 순으로 보인다(웹 team/TeamSynergy.svelte와 같은 내용).
// 켜진 시너지는 누르면 그라운드에서 그 선수들을 잇는다. 누르는 것과 상관없이 켜진 것은 모두 적용된다.
import { View } from 'react-native';
import {
  DUO_LINE_CAP,
  DUO_TOTAL_CAP,
  synergyPower,
  type TeamSynergy as Synergy,
} from '@offside/contracts/owner-team';
import { synergyRows, synergyNote, type SynergyRow } from '@offside/app-core/teamOwner';
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
  const power = synergyPower(synergy);
  const rows = synergyRows(synergy);
  const anyOn = rows.some((r) => r.state !== 'off');
  const stateText = { applied: L.chipApplied, noEffect: L.chipNoEffect, off: L.chipOff };
  const row = (r: SynergyRow) => {
    const viewing = focus === r.id;
    const applied = r.state === 'applied';
    const state = viewing ? L.chipViewing : stateText[r.state];
    const body = (
      <>
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderStyle: r.state === 'off' ? 'dashed' : 'solid',
            borderColor: applied ? c.accent : c.line,
            backgroundColor: applied ? c.accent : 'transparent',
          }}
        >
          {applied ? (
            <Txt bold style={{ fontSize: 10, lineHeight: 12, color: c.accentInk }}>
              ✓
            </Txt>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Txt v="sm" bold>
            {r.name}
          </Txt>
          <Txt v="xs" tone="muted">
            {r.desc}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3, maxWidth: '42%' }}>
          <Txt v="xs" tone={applied ? 'accent' : 'muted'} style={{ textAlign: 'right' }}>
            {r.effect}
          </Txt>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 1,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: viewing ? c.accent : applied ? `${c.accent}80` : c.line,
              backgroundColor: viewing ? c.accent : 'transparent',
            }}
          >
            <Txt
              bold
              style={{
                fontSize: 10,
                lineHeight: 13,
                color: viewing ? c.accentInk : applied ? c.accentText : c.muted,
              }}
            >
              {state}
            </Txt>
          </View>
        </View>
      </>
    );
    const style = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: r.badge ? ('dashed' as const) : ('solid' as const),
      // 적용 중은 모두 같은 모습 — 누른 줄은 고른 것처럼 보이지 않게 배경만 바꾸고 '보는 중'을 단다.
      borderColor: applied ? `${c.accent}80` : c.line,
      backgroundColor: viewing ? `${c.accent}2e` : r.state === 'off' ? 'transparent' : c.surface2,
      opacity: r.state === 'off' ? 0.62 : 1,
    };
    return r.state === 'off' ? (
      <View key={r.id} testID={`synergy-${r.id}`} style={style}>
        {body}
      </View>
    ) : (
      <Press
        key={r.id}
        testID={`synergy-${r.id}`}
        accessibilityLabel={`${r.name} · ${r.effect} · ${state}`}
        accessibilityState={{ selected: viewing }}
        onPress={() => setFocus(viewing ? null : r.id)}
        style={style}
      >
        {body}
      </Press>
    );
  };
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
      <Txt v="xs" tone="muted">
        {anyOn ? L.chipHint : L.empty}
      </Txt>
      <View style={{ gap: 6 }}>{rows.map(row)}</View>
      <Txt v="xs" tone="muted">
        {L.capNote({ line: DUO_LINE_CAP, total: DUO_TOTAL_CAP })}
      </Txt>
    </View>
  );
}
