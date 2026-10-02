// T-10-012 확률 도감(웹 EventDex.svelte). 공통 규칙과 이벤트별 선택지 확률(범위·영향 요인)을 게임 코드에서 직접 뽑아 보여
// 준다. 스토리·특별 이벤트는 한 번 겪어야 열린다(스포일러 보호). 분석 코드와 함께 처음 열 때 불러오는 화면이다.
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import '@offside/game/index';
import { DEX_GROUPS, eventDex, type DexEntry, type DexGroup } from '@offside/game/eventDex';
import { dexRules, oddsText } from '@offside/app-core/dexText';
import { dexSeen } from '@offside/app-core/dex';
import { goHome } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { BackBar } from '../../ui/ActionBar';
import { Card } from '../../ui/Card';
import { Chip, Pill } from '../../ui/bits';
import { Press } from '../../ui/Press';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { AutoGrid, TabOpt } from '../board/parts';

/** 이벤트 한 칸 — 눌러서 선택지별 확률을 펼친다(웹 <details>). */
function DexItem({
  e,
  found,
  locked,
  first,
}: {
  e: DexEntry;
  found: boolean;
  locked: boolean;
  first: boolean;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const wrap = {
    borderTopWidth: first ? 0 : 1,
    borderTopColor: c.line,
    paddingVertical: 10,
    paddingHorizontal: 2,
  } as const;
  if (locked)
    return (
      <View testID={`dex-${e.ids[0]}`} style={[wrap, { flexDirection: 'row', gap: 8 }]}>
        <Txt accessibilityElementsHidden style={{ fontSize: rem(0.875) }}>
          🔒
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.875), flex: 1 }}>
          {`아직 만나지 못한 ${e.group === 'story' ? `스토리 이벤트 · ${e.story?.stage ?? '?'}단계` : '특별 이벤트'}`}
        </Txt>
      </View>
    );
  return (
    <View testID={`dex-${e.ids[0]}`} style={wrap}>
      <Press
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        scale={0.99}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          minHeight: 32,
        }}
      >
        <Txt bold style={{ flex: 1 }}>
          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
            {open ? '▾ ' : '▸ '}
          </Txt>
          {found ? (
            <Txt accessibilityLabel="발견" style={{ color: c.good, fontWeight: '700' }}>
              {'✓ '}
            </Txt>
          ) : null}
          {e.title}
        </Txt>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            flexShrink: 1,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          {e.pos ? <Pill>{e.pos}</Pill> : null}
          {e.story ? <Pill>{`${e.story.name} ${e.story.stage}/${e.story.total}`}</Pill> : null}
        </View>
      </Press>
      {open ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {e.choices.map((ch, i) => (
            <View
              key={i}
              style={{
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: c.surface2,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <Txt style={{ flex: 1, fontSize: rem(0.875) }}>{ch.label}</Txt>
                <Txt
                  bold
                  style={{
                    fontSize: rem(0.875),
                    fontVariant: ['tabular-nums'],
                    color: ch.kind !== 'odds' ? c.good : c.ink,
                  }}
                >
                  {oddsText(ch)}
                </Txt>
              </View>
              {ch.factors.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ch.factors.map((f) => (
                    <Chip
                      key={f.label}
                      text={`${f.up ? '▲' : '▼'} ${f.label}`}
                      dir={f.up ? 'up' : 'down'}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          {e.dependsOnPast ? (
            <Txt tone="muted" style={{ fontSize: rem(0.75), marginTop: -2 }}>
              앞 단계에서 한 선택에 따라 확률이 달라져요.
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function Dex() {
  const RULES = useMemo(() => dexRules(), []);
  const [dex, setDex] = useState<DexEntry[] | null>(null);
  const [filter, setFilter] = useState<DexGroup | 'all'>('all');
  const [rulesOpen, setRulesOpen] = useState(true);
  const seen = useMemo(() => dexSeen(appState.G), []);
  const found = (e: DexEntry) => e.ids.some((id) => seen.has(id));
  const hidden = (e: DexEntry) => DEX_GROUPS.find((g) => g.id === e.group)!.hidden && !found(e);
  // 전체 보기는 분류 순서(커리어 → 포지션 → 스토리 → 특별)로 묶는다.
  const order = (e: DexEntry) => DEX_GROUPS.findIndex((g) => g.id === e.group);
  const shown = dex
    ? dex.filter((e) => filter === 'all' || e.group === filter).sort((a, b) => order(a) - order(b))
    : [];
  const foundCount = dex ? dex.filter(found).length : 0;

  // 분석은 수십~수백 ms라 화면을 먼저 그린 뒤 계산한다.
  useEffect(() => {
    const t = setTimeout(() => setDex(eventDex()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <Screen footer={<BackBar testID="home" fallback={goHome} />}>
      <Topbar />
      <Card gap={14}>
        <View>
          <Txt v="eyebrow">Odds</Txt>
          <Txt v="h1" accessibilityRole="header">
            확률 도감
          </Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.8125), marginTop: 6 }}>
            선택지의 성공 확률은 선수 상태로 계산돼요. 게임 코드에서 직접 뽑은 범위와 영향 요인을
            그대로 공개해요.
          </Txt>
        </View>

        <View testID="dex-rules">
          <Press
            accessibilityState={{ expanded: rulesOpen }}
            onPress={() => setRulesOpen((v) => !v)}
            scale={0.99}
            style={{ minHeight: 32, justifyContent: 'center' }}
          >
            <Txt bold>
              <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                {rulesOpen ? '▾ ' : '▸ '}
              </Txt>
              공통 규칙
            </Txt>
          </Press>
          {rulesOpen ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {RULES.map(([term, desc]) => (
                <View key={term} style={{ gap: 4 }}>
                  <Txt
                    bold
                    style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5, marginTop: 6 }}
                  >
                    {term}
                  </Txt>
                  <Txt
                    tone="muted"
                    style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5 }}
                  >
                    {desc}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {!dex ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            확률을 계산하는 중…
          </Txt>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Txt v="h2" accessibilityRole="header">
                이벤트
              </Txt>
              <Txt tone="muted" testID="dex-progress" style={{ fontSize: rem(0.8125) }}>
                {`발견 ${foundCount}/${dex.length}`}
              </Txt>
            </View>
            <AutoGrid
              min={56}
              gap={6}
              items={[
                <TabOpt
                  key="all"
                  tight
                  title="전체"
                  selected={filter === 'all'}
                  testID="dex-filter-all"
                  onPress={() => setFilter('all')}
                />,
                ...DEX_GROUPS.map((g) => (
                  <TabOpt
                    key={g.id}
                    tight
                    title={g.name}
                    selected={filter === g.id}
                    testID={`dex-filter-${g.id}`}
                    onPress={() => setFilter(g.id)}
                  />
                )),
              ]}
            />
            <View>
              {shown.map((e, i) => (
                <DexItem key={e.ids[0]} e={e} found={found(e)} locked={hidden(e)} first={i === 0} />
              ))}
            </View>
            <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
              ▲는 값이 클수록 성공 확률이 오르고, ▼는 내려가요. 범위는 가능한 선수 상태 전체에서
              나올 수 있는 최저~최고예요.
            </Txt>
          </>
        )}
      </Card>
    </Screen>
  );
}
