// 내 팀 화면들이 함께 쓰는 작은 부품(웹 team/Team.svelte 의 .seg · .opt · .tm-title · .tm-actions · .tm-ovr-badge).
import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { AchGrade } from '@offside/contracts/owner-team';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { achGradeName } from '@offside/app-core/teamOwner';
import { alpha, mix } from '../../theme/colors';
import { useColors, useIsDark } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Press, Txt } from '../../ui';
import { GradeEmblem } from '../../ui/GradeEmblem';

/** 고르기 버튼 한 칸(웹 .opt · aria-pressed). Opt와 같은 모양에 e2e 식별자를 받는다. */
export function SegBtn({
  selected,
  onPress,
  disabled,
  testID,
  label,
  children,
  center,
}: {
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  label?: string;
  children: ReactNode;
  center?: boolean;
}) {
  const c = useColors();
  const dark = useIsDark();
  const on = dark ? c.accent : c.pitch;
  return (
    <Press
      scale={0.985}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={{
        flex: 1,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? on : c.line,
        backgroundColor: selected ? alpha(c.pitch, 0.08) : c.surface,
        borderRadius: 12,
        paddingVertical: selected ? 9.5 : 10,
        paddingHorizontal: selected ? 11.5 : 12,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: center ? 'center' : 'flex-start',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </Press>
  );
}

/** 같은 폭 칸 여러 개를 가로로(웹 .seg.two · .seg.three). */
export function Seg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 8 }}
    >
      {children}
    </View>
  );
}

/** 눈썹 + 제목 왼쪽, 오른쪽에 뱃지·고르기(웹 .tm-title). */
export function TmTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="eyebrow">{eyebrow}</Txt>
        <Txt v="h1" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {right}
    </View>
  );
}

/** 팀 OVR 뱃지(웹 .tm-ovr-badge). */
export function OvrBadge({ ovr }: { ovr: number }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={L.teamOvr({ n: ovr })}
      style={{
        minWidth: 58,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: c.pitch,
        alignItems: 'center',
      }}
    >
      <Txt
        style={{
          fontFamily: DISPLAY[400],
          fontSize: rem(0.6875),
          lineHeight: rem(0.6875) * 1.1,
          letterSpacing: 0.12 * rem(0.6875),
          color: c.onPitch,
        }}
      >
        OVR
      </Txt>
      <Txt
        style={{
          fontFamily: DISPLAY[700],
          fontSize: rem(1.625),
          lineHeight: rem(1.625) * 1.1,
          color: c.pitchAccent,
        }}
      >
        {ovr}
      </Txt>
    </View>
  );
}

/** 두 칸 격자(웹 .tm-actions: 1fr 1fr, gap 8) — 버튼이 셋이면 셋째는 둘째 줄 왼쪽 반 폭. */
export function Grid2({
  children,
  style,
}: {
  children: ReactNode[] | ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const list = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}
    >
      {list.map((ch, i) => (
        <View key={i} style={{ width: w ? (w - 8) / 2 : '48%' }}>
          {ch}
        </View>
      ))}
    </View>
  );
}

/** Stats 칸을 누를 수 있게(구단주 요약의 구단 자금 → 자금 내역). 이름 옆에 › 를 붙인다. */
export type StatPress = { onPress: () => void; label: string; testID: string };

/** 숫자 칸 줄(웹 .owner-stats · .tm-stats). first는 첫 칸 너비 비율(전적처럼 긴 값). */
export function Stats({
  items,
  small,
  accent,
  first = 1,
}: {
  items: [string, string, StatPress?][];
  small?: boolean;
  /** 첫 칸을 크게·강조색으로(구단주 요약의 구단 가치). */
  accent?: boolean;
  first?: number;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map(([k, v, press], i) => {
        const style: ViewStyle = {
          flex: i === 0 ? first : 1,
          minWidth: 0,
          gap: 2,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: c.surface2,
        };
        const body = (
          <>
            <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
              {press ? `${k} ›` : k}
            </Txt>
            <Txt
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(accent && i === 0 ? 1.75 : small ? 1.0625 : 1.25),
                fontVariant: ['tabular-nums'],
                ...(accent && i === 0 ? { color: c.accentText } : null),
              }}
            >
              {v}
            </Txt>
          </>
        );
        return press ? (
          <Press
            key={k}
            testID={press.testID}
            accessibilityLabel={`${k} ${v}, ${press.label}`}
            onPress={press.onPress}
            style={style}
          >
            {body}
          </Press>
        ) : (
          <View key={k} accessible accessibilityLabel={`${k} ${v}`} style={style}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** T-11-028 등급 색(웹 style.css .ach-grade[data-grade] --g) — 등급 이름 글자에 잉크와 섞어 쓴다. 모르는 등급은 루키 색. */
export const GRADE_COLOR: Record<string, string> = {
  rookie: '#7f9a86',
  bronze: '#c27a3e',
  silver: '#9aa6b1',
  gold: '#d9a21b',
  platinum: '#2bb3a3',
  diamond: '#4c7dff',
  legend: '#c04cff',
};

/**
 * 시즌 업적 등급 배지(웹 AchGradeBadge.svelte) — T-11-033부터 엠블럼 + 등급 이름. 요약(large)·구단주 랭킹 공용.
 * emblem=false면 이름만(엠블럼을 옆에 따로 크게 그리는 구단주 랭킹 줄).
 */
export function AchGradeBadge({
  grade,
  large,
  emblem = true,
}: {
  grade: AchGrade;
  large?: boolean;
  emblem?: boolean;
}) {
  const c = useColors();
  const g = GRADE_COLOR[grade.id] ?? GRADE_COLOR.rookie!;
  const fs = rem(large ? 1 : 0.6875);
  return (
    <View
      testID={`ach-grade-${grade.id}`}
      accessible
      accessibilityLabel={L.gradeAria({ name: achGradeName(grade) })}
      style={{
        flexShrink: 0,
        alignSelf: emblem ? 'center' : 'flex-end',
        flexDirection: 'row',
        alignItems: 'center',
        gap: large ? 8 : 4,
      }}
    >
      {emblem ? <GradeEmblem id={grade.id} size={large ? 44 : 20} /> : null}
      <Txt
        numberOfLines={1}
        style={{
          fontSize: fs,
          lineHeight: fs * 1.2,
          fontWeight: '800',
          letterSpacing: 0.02 * fs,
          color: mix(g, c.ink, 0.65),
        }}
      >
        {achGradeName(grade)}
      </Txt>
    </View>
  );
}
