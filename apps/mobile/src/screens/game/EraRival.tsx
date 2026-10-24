// T-11-475 시대의 라이벌(웹 ui/era/*): 나 · 라이벌 비교 표, 시즌 결산 카드, 트로피 탭 카드.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import type { EraCardView, EraRow, EraTabView, EraWho } from '@offside/app-core/era-view';
import { eraText as L } from '@offside/app-core/i18n/ko/era';
import { useState } from 'react';
import { View } from 'react-native';
import { Hl, mixColor } from '../../sheets/parts';
import { Pop } from '../../sheets/anim';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { TrophyRow } from './TrophyTab';

function EraRows({ rows }: { rows: readonly EraRow[] }) {
  const c = useColors();
  const cell = (v: string, win: boolean) => (
    <Txt
      style={{
        width: 64,
        textAlign: 'right',
        fontSize: rem(FONT.body2),
        fontWeight: win ? '800' : '600',
        color: win ? c.accentText : c.muted,
        fontVariant: ['tabular-nums'],
      }}
    >
      {v}
    </Txt>
  );
  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
        <View style={{ flex: 1 }} />
        <Txt v="xs" tone="muted" style={{ width: 64, textAlign: 'right' }}>
          {L.me}
        </Txt>
        <Txt v="xs" tone="muted" style={{ width: 64, textAlign: 'right' }}>
          {L.rival}
        </Txt>
      </View>
      {rows.map((r) => (
        <View
          key={r.label}
          accessible
          accessibilityLabel={`${r.label} ${L.me} ${r.me} ${L.rival} ${r.rival}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 5,
            borderTopWidth: 1,
            borderTopColor: c.line,
          }}
        >
          <Txt tone="muted" style={{ flex: 1, fontSize: rem(FONT.body2) }}>
            {r.label}
          </Txt>
          {cell(r.me, r.win > 0)}
          {cell(r.rival, r.win < 0)}
        </View>
      ))}
    </View>
  );
}

function Who({ who }: { who: EraWho }) {
  return (
    <Txt style={{ marginTop: 4 }}>
      {who.flag ? `${who.flag} ` : ''}
      <Txt style={{ fontWeight: '700' }}>{who.name}</Txt>
      <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>{`  ${who.line}`}</Txt>
    </Txt>
  );
}

/** 시즌 결산 카드. */
export function EraCard({ v }: { v: EraCardView }) {
  const c = useColors();
  return (
    <Pop from={0.4} ms={400} delay={160}>
      <View
        testID={`era-card-${v.kind}`}
        style={{
          gap: 4,
          padding: 12,
          borderRadius: RADIUS.md,
          backgroundColor: mixColor(c.accent, c.surface, 12),
          borderWidth: 1,
          borderColor: alpha(c.accent, 0.5),
        }}
      >
        <Txt v="eyebrow">Era Rival</Txt>
        <Txt bold style={{ color: c.accentText }}>
          {v.title}
        </Txt>
        {v.intro ? (
          <Txt v="sm" tone="muted">
            {v.intro}
          </Txt>
        ) : null}
        <Who who={v.who} />
        <EraRows rows={v.rows} />
        {v.ballon ? (
          <Hl>
            <Txt style={{ fontSize: rem(FONT.body2), fontWeight: '700' }}>{v.ballon}</Txt>
          </Hl>
        ) : null}
        {v.honors.length ? (
          <Txt v="xs" tone="muted">{`${L.rivalHonors} · ${v.honors.join(' · ')}`}</Txt>
        ) : null}
        <Txt v="sm">{v.verdict}</Txt>
      </View>
    </Pop>
  );
}

/** 트로피 탭 카드: 통산 비교 · 라이벌 시즌 기록 · 지나간 라이벌. */
export function EraTabCard({ v }: { v: EraTabView }) {
  const [open, setOpen] = useState(false);
  return (
    <Card gap={4}>
      <Txt v="eyebrow">Era Rival</Txt>
      <Txt v="h2" accessibilityRole="header">
        {L.tabTitle}
      </Txt>
      <Who who={v.who} />
      <Txt v="xs" tone="muted">
        {v.status}
      </Txt>
      <EraRows rows={v.rows} />
      <Txt v="sm">{v.verdict}</Txt>
      <Press
        testID="era-seasons"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
      >
        <Txt v="sm" style={{ textDecorationLine: 'underline' }}>
          {L.seasonsHead}
        </Txt>
      </Press>
      {open
        ? v.seasons.map((x, i) => (
            <TrophyRow key={x.year} year={x.year} first={i === 0}>
              <Txt style={{ fontWeight: '700' }}>{x.line}</Txt>
              {x.honors.length ? (
                <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                  {x.honors.join(' · ')}
                </Txt>
              ) : null}
            </TrophyRow>
          ))
        : null}
      {v.past.length ? <Txt v="xs" tone="muted">{`${L.past} · ${v.past.join(' · ')}`}</Txt> : null}
    </Card>
  );
}
