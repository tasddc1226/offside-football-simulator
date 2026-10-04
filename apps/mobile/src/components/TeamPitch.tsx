import type { RefObject } from 'react';
import { Pressable, View } from 'react-native';
import { presetLayout, type FormationId, type TeamLayout } from '@offside/contracts/owner-team';
import type { TeamLines as Lines } from '@offside/app-core/api/team';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { PlayerCard, type PlayerCardData } from './PlayerCard';
import { DragPlayer, type PlayerDrag } from './DragPlayer';
import { DEFAULT_NATION, NATION_BY_CODE } from '@offside/contracts/nations';

export type PitchCell = PlayerCardData;
export function TeamPitch({
  formation,
  cells,
  layout,
  onpick,
  ondrag,
  pitchRef,
  selected,
  animate = true,
  onplace,
  height = 450,
}: {
  formation: FormationId;
  cells: readonly PitchCell[];
  layout?: TeamLayout | null;
  onpick?: ((i: number) => void) | undefined;
  ondrag?: PlayerDrag | undefined;
  pitchRef?: RefObject<View | null>;
  selected?: number | null;
  animate?: boolean;
  onplace?: ((x: number, y: number) => void) | undefined;
  height?: number;
}) {
  const c = useColors();
  const positions = layout ?? presetLayout(formation);
  return (
    <View testID="team-pitch" style={{ height, borderRadius: 16, backgroundColor: c.pitch }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 16 }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: ((i + 0.5) * height) / 5,
              height: height / 10,
              left: 0,
              right: 0,
              backgroundColor: c.pitch2,
            }}
          />
        ))}
        <View style={{ position: 'absolute', inset: 12, borderWidth: 1, borderColor: c.chalk }} />
        <View
          style={{
            position: 'absolute',
            top: '50%',
            left: 12,
            right: 12,
            height: 1,
            backgroundColor: c.chalk,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: height / 2 - 40,
            left: '50%',
            marginLeft: -40,
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 1,
            borderColor: c.chalk,
          }}
        />
        {[true, false].map((top) => (
          <View
            key={String(top)}
            style={{
              position: 'absolute',
              left: '25%',
              right: '25%',
              height: 60,
              ...(top ? { top: 12 } : { bottom: 12 }),
              borderWidth: 1,
              borderColor: c.chalk,
            }}
          />
        ))}
      </View>
      <View
        ref={pitchRef}
        collapsable={false}
        style={{ position: 'absolute', top: 20, bottom: 20, left: 12, right: 12 }}
      >
        {onplace ? (
          <Pressable
            testID="pitch-space"
            accessibilityLabel="선택한 선수를 그라운드 빈 공간에 배치"
            onPress={(e) => onplace(e.nativeEvent.locationX, e.nativeEvent.locationY)}
            style={{ position: 'absolute', inset: 0 }}
          />
        ) : null}
        {positions.map((pos, i) => {
          const cell = cells[i];
          if (!cell) return null;
          const country = !cell.youth
            ? NATION_BY_CODE.get(cell.nation ?? DEFAULT_NATION)
            : undefined;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: 62,
                height: 88,
                marginLeft: -31,
                marginTop: -44,
                zIndex: selected === i ? 2 : 1,
              }}
            >
              <DragPlayer index={i} id={null} drag={ondrag}>
                <Press
                  testID={`slot-${i}`}
                  onPress={onpick ? () => onpick(i) : undefined}
                  accessibilityLabel={`${pos.slot} · ${cell.name}${country ? ` · ${country.ko}` : ''} · 포지션 OVR ${cell.rating}${ondrag ? ' · 길게 눌러 이동' : ''}`}
                  accessibilityState={{ selected: selected === i }}
                  style={{
                    borderRadius: 10,
                    borderWidth: selected === i ? 2 : 0,
                    borderColor: c.pitchAccent,
                  }}
                >
                  <PlayerCard cell={cell} code={pos.slot} compact animate={animate} />
                </Press>
              </DragPlayer>
            </View>
          );
        })}
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
