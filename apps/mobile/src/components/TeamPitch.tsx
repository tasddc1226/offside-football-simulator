// T-10-092 팀 선발 그라운드(웹 team/TeamPitch.svelte · TeamLines.svelte). 공격이 위. 내 팀 편성(자리를 눌러 선수 고르기)과
// 팀 프로필(보기만)이 함께 쓴다. TeamLines는 팀의 공격·중원·수비·골문 힘.
import { useState } from 'react';
import { View } from 'react-native';
import {
  DETAIL_LABEL,
  FORMATION_ROWS,
  FORMATIONS,
  type FormationId,
} from '@offside/contracts/owner-team';
import type { TeamLines as Lines } from '@offside/app-core/api/team';
import { alpha } from '../theme/colors';
import { DISPLAY, rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { useShadow } from '../ui/Card';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export type PitchCell = { rating: number; name: string; youth: boolean };

function Slot({
  code,
  cell,
  index,
  onpick,
}: {
  code: string;
  cell: PitchCell;
  index: number;
  onpick?: ((i: number) => void) | undefined;
}) {
  const c = useColors();
  const label = `${DETAIL_LABEL[code as keyof typeof DETAIL_LABEL]} · ${cell.name} · ${cell.rating}`;
  const style = {
    flex: 1,
    flexBasis: 0,
    maxWidth: 76,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderStyle: cell.youth ? 'dashed' : 'solid',
    borderColor: alpha(c.onPitch, 0.35),
    borderRadius: 12,
    backgroundColor: cell.youth ? 'transparent' : 'rgba(0,0,0,0.22)',
  } as const;
  const inner = (
    <>
      <Txt
        style={{
          fontFamily: DISPLAY[400],
          fontSize: rem(0.6875),
          lineHeight: rem(0.6875) * 1.4,
          letterSpacing: 0.08 * rem(0.6875),
          color: c.onPitch,
        }}
      >
        {code}
      </Txt>
      <Txt
        style={{
          fontFamily: DISPLAY[700],
          fontVariant: ['tabular-nums'],
          fontSize: rem(1.25),
          lineHeight: rem(1.25),
          color: cell.youth ? c.onPitch : c.pitchAccent,
        }}
      >
        {cell.rating}
      </Txt>
      <Txt
        numberOfLines={1}
        style={{
          maxWidth: '100%',
          fontSize: rem(0.6875),
          lineHeight: rem(0.6875) * 1.4,
          color: c.onPitch,
        }}
      >
        {cell.name}
      </Txt>
    </>
  );
  return onpick ? (
    <Press
      testID={`slot-${index}`}
      accessibilityLabel={label}
      onPress={() => onpick(index)}
      style={style}
    >
      {inner}
    </Press>
  ) : (
    <View
      testID={`slot-${index}`}
      accessible
      accessibilityRole="none"
      accessibilityLabel={label}
      style={style}
    >
      {inner}
    </View>
  );
}

export function TeamPitch({
  formation,
  cells,
  onpick,
}: {
  formation: FormationId;
  cells: readonly PitchCell[];
  onpick?: ((i: number) => void) | undefined;
}) {
  const c = useColors();
  const shadow = useShadow();
  const [h, setH] = useState(0);
  const codes = FORMATIONS[formation];
  /** 그라운드 줄(공격이 위). 각 줄은 자리 인덱스 목록. */
  const rows = (() => {
    let at = 0;
    return FORMATION_ROWS[formation]
      .map((n) => {
        const row = Array.from({ length: n }, (_, k) => at + k);
        at += n;
        return row;
      })
      .reverse();
  })();
  const filled = cells.filter((x) => !x.youth).length;
  return (
    <View
      accessibilityLabel={`선발 ${filled}명 · 나머지 유스 선수`}
      style={[{ borderRadius: 16, backgroundColor: c.pitch }, shadow]}
    >
      <View
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          gap: 10,
          paddingVertical: 14,
          paddingHorizontal: 6,
        }}
      >
        {/* 잔디 줄무늬(44px씩 번갈아)와 하프라인. */}
        {Array.from({ length: Math.ceil(h / 88) }, (_, k) => (
          <View
            key={k}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: k * 88 + 44,
              height: 44,
              backgroundColor: c.pitch2,
            }}
          />
        ))}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: Math.floor(h / 2),
            height: 1,
            backgroundColor: c.chalk,
          }}
        />
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-around', gap: 4 }}>
            {row.map((i) => {
              const cell = cells[i];
              return cell ? (
                <Slot key={i} code={codes[i]!} cell={cell} index={i} onpick={onpick} />
              ) : null;
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** 팀의 공격·중원·수비·골문 힘(내 팀 편성 · 팀 프로필). */
const CELLS = [
  ['atk', '공격'],
  ['mid', '중원'],
  ['def', '수비'],
  ['gk', '골문'],
] as const;

export function TeamLines({ lines }: { lines: Lines }) {
  const c = useColors();
  return (
    <View testID="team-lines" style={{ flexDirection: 'row', gap: 6 }}>
      {CELLS.map(([k, label]) => (
        <View
          key={k}
          accessible
          accessibilityLabel={`${label} ${Math.round(lines[k])}`}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: c.surface2,
          }}
        >
          <Txt tone="muted" style={{ fontSize: rem(0.75), lineHeight: rem(0.75) * 1.5 }}>
            {label}
          </Txt>
          <Txt num style={{ fontSize: rem(1.25), lineHeight: rem(1.25) * 1.3, fontWeight: '700' }}>
            {Math.round(lines[k])}
          </Txt>
        </View>
      ))}
    </View>
  );
}
