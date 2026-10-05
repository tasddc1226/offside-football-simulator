// 능력치 카드(웹 AttrCard.svelte): 레이더 · 범례 · 포지션별 OVR · 세부 능력치 목록(2단) · 안내.
import { Text, View, useWindowDimensions } from 'react-native';
import { attrData } from '@offside/app-core/format';
import { gameAttrText as L } from '@offside/app-core/i18n/ko/gameAttr';
import { ovr } from '@offside/game/attributes';
import type { GameState } from '@offside/game/types';
import { mixColor } from '../../sheets/parts';
import { useColors } from '../../theme/useColors';
import type { Colors } from '../../theme/colors';
import { DISPLAY, num, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/bits';
import { Txt } from '../../ui/Txt';
import { Radar } from './Radar';

type Data = ReturnType<typeof attrData>;

/** 웹 .t1~.t4 — 능력치 등급 색(80↑ 좋음 · 70↑ · 50↑ · 그 아래 나쁨). */
const tierColor = (c: Colors, t: 't1' | 't2' | 't3' | 't4') =>
  t === 't4' ? c.good : t === 't3' ? mixColor(c.good, c.accent, 55) : t === 't2' ? c.warn : c.bad;

/** 웹 CSS columns: 2 — 그룹을 위에서부터 채우다 높이가 반을 넘는 자리에서 다음 단으로 넘긴다. */
function splitColumns(groups: Data['groups']): [Data['groups'], Data['groups']] {
  const h = groups.map((g) => 1.6 + g.rows.length);
  const total = h.reduce((a, b) => a + b, 0);
  let acc = 0;
  let cut = groups.length;
  for (let i = 0; i < groups.length; i++) {
    if (acc + h[i]! / 2 > total / 2) {
      cut = i;
      break;
    }
    acc += h[i]!;
  }
  return [groups.slice(0, cut), groups.slice(cut)];
}

function Group({ g }: { g: Data['groups'][number] }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingBottom: 4,
          marginBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>
          <Txt
            tone="muted"
            style={{
              fontFamily: DISPLAY[400],
              fontSize: rem(0.75),
              letterSpacing: rem(0.75) * 0.08,
            }}
          >{`${g.abbr}  `}</Txt>
          {g.labelKr}
        </Txt>
        <Txt
          style={[
            num(700),
            { fontSize: rem(1.375), lineHeight: rem(1.375), color: tierColor(c, g.tier) },
          ]}
        >
          {g.value}
        </Txt>
      </View>
      {g.rows.map((row) => (
        <View
          key={row.key}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
            paddingVertical: 2,
          }}
        >
          <Txt
            tone={row.bold ? 'ink' : 'muted'}
            style={{ flexShrink: 1, fontSize: rem(0.8125), fontWeight: row.bold ? '600' : '400' }}
          >
            {row.name}
          </Txt>
          <Txt style={[num(700), { fontSize: rem(1), color: tierColor(c, row.tier) }]}>
            {row.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function AttrCard({ s }: { s: GameState }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const d = attrData(s);
  const [colA, colB] = splitColumns(d.groups);
  // 웹은 화면 폭 330px 이하에서 한 단으로 줄인다.
  const one = width <= 330;
  return (
    <Card gap={0}>
      <Txt v="eyebrow">Attributes</Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 2,
        }}
      >
        <Txt v="h2" accessibilityRole="header">
          {L.title}
        </Txt>
        <Pill>{`${d.roleName} · OVR ${ovr(s)}`}</Pill>
      </View>
      <Radar s={s} />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
      >
        <View style={{ width: 16, marginLeft: 8, borderTopWidth: 2, borderTopColor: c.accent }} />
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {L.legendNow}
        </Txt>
        <View
          style={{
            width: 16,
            marginLeft: 8,
            borderTopWidth: 2,
            borderTopColor: c.muted,
            borderStyle: 'dashed',
          }}
        />
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {L.legendPrev}
        </Txt>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 14,
          rowGap: 4,
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: c.line,
        }}
      >
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          {L.roleOvr}
        </Txt>
        {d.roles.map((r) => {
          const color = r.on ? c.accentText : c.muted;
          return (
            <Txt
              key={r.role}
              accessibilityLabel={`${r.title} ${r.ovr}`}
              style={{
                fontFamily: DISPLAY[600],
                fontSize: rem(0.8125),
                letterSpacing: rem(0.8125) * 0.06,
                color,
              }}
            >
              {`${r.role} `}
              <Text
                style={[
                  num(700),
                  { fontSize: rem(1.125), letterSpacing: 0, color: r.on ? c.accentText : c.ink },
                ]}
              >
                {r.ovr}
              </Text>
            </Txt>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 14 }}>
        {(one ? [d.groups] : [colA, colB]).map((col, i) => (
          <View key={i} style={{ flex: 1 }}>
            {col.map((g) => (
              <Group key={g.key} g={g} />
            ))}
          </View>
        ))}
      </View>
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        <Txt style={{ fontSize: rem(0.75), fontWeight: '700' }}>{L.noteBold}</Txt>
        {L.noteRest({ role: d.roleName })}
      </Txt>
    </Card>
  );
}
