// 칭호 도감(웹 titles/TitleDex.svelte, T-10-026, 트로피 탭). 얻은 칭호는 눌러서 대표 칭호로 고르고(다시 누르면 자동
// 선택으로), 못 얻은 칭호는 접힌 목록에서 조건·진행도를 본다. 숨김 칭호는 얻기 전까지 이름을 가린다.
import { useState } from 'react';
import { View } from 'react-native';
import {
  TITLES,
  TITLE_CATS,
  RARITY_LABEL,
  mainTitle,
  titleById,
  type TitleDef,
} from '@offside/game/titles';
import type { GameState } from '@offside/game/types';
import { titleText as L } from '@offside/app-core/i18n/ko/title';
import { TitleTag } from '../../components/TitleTag';
import { buzz, save } from '../../game/host';
import { appState } from '../../store';
import { useColors } from '../../theme/useColors';
import { num, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

export function TitleDex({ s }: { s: GameState }) {
  const c = useColors();
  const [openLocked, setOpenLocked] = useState(false);
  const earned = (s.titles ?? [])
    .map((e) => ({ d: titleById(e.id), year: e.year }))
    .filter((x): x is { d: TitleDef; year: number } => !!x.d)
    .sort((a, b) => b.d.rarity - a.d.rarity || b.year - a.year);
  const have = new Set(earned.map((x) => x.d.id));
  // T-10-096 국적으로 얻을 수 없는 칭호(다른 대륙컵·병역 등)는 도감에서 뺀다.
  const pool = TITLES.filter((d) => !d.avail || d.avail(s) || have.has(d.id));
  const main = mainTitle(s);
  const locked = TITLE_CATS.map((cat) => ({
    ...cat,
    list: pool.filter((d) => d.cat === cat.id && !have.has(d.id)),
  })).filter((cat) => cat.list.length);

  function pick(id: string) {
    const g = appState.G!;
    if (g.titleSel === id) delete g.titleSel;
    else g.titleSel = id;
    save();
  }

  return (
    <Card gap={10}>
      <View
        testID="title-dex"
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <View>
          <Txt v="eyebrow">Titles</Txt>
          <Txt v="h2" accessibilityRole="header">
            {L.dexTitle}
          </Txt>
        </View>
        <Txt
          tone="muted"
          num
          style={{ fontSize: rem(0.8125) }}
        >{`${earned.length} / ${pool.length}`}</Txt>
      </View>
      {main ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Txt style={{ fontSize: rem(0.875) }}>{L.mainTitle}</Txt>
          <TitleTag name={main.name} rarity={main.rarity} />
          <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
            {s.titleSel ? L.selManual : L.selAuto}
          </Txt>
        </View>
      ) : null}
      {earned.length ? (
        <>
          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
            {L.pickHint}
          </Txt>
          <View style={{ gap: 6 }}>
            {earned.map((x) => {
              const on = main?.id === x.d.id;
              return (
                <Press
                  key={x.d.id}
                  scale={0.985}
                  testID={`title-${x.d.id}`}
                  accessibilityLabel={L.itemLabel({
                    rarity: RARITY_LABEL[x.d.rarity],
                    name: x.d.name,
                    desc: x.d.desc,
                  })}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    buzz();
                    pick(x.d.id);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: on ? 7.5 : 8,
                    paddingHorizontal: on ? 9.5 : 10,
                    borderRadius: 10,
                    borderWidth: on ? 2.5 : 1.5,
                    borderColor: on ? c.accent : c.line,
                    backgroundColor: c.surface,
                  }}
                >
                  <TitleTag name={x.d.name} rarity={x.d.rarity} />
                  <Txt tone="muted" style={{ flex: 1, fontSize: rem(0.75) }}>
                    {x.d.desc}
                  </Txt>
                  <Txt tone="muted" num style={{ fontSize: rem(0.75) }}>
                    {x.year ? x.year : L.earlier}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </>
      ) : (
        <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
          {L.emptyEarned}
        </Txt>
      )}
      {locked.length ? (
        <View>
          <Press
            testID="title-locked-toggle"
            accessibilityState={{ expanded: openLocked }}
            onPress={() => setOpenLocked(!openLocked)}
            style={{ paddingVertical: 4 }}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
              {`${openLocked ? '▾' : '▸'} ${L.lockedSummary({ n: pool.length - earned.length })}`}
            </Txt>
          </Press>
          {openLocked
            ? locked.map((cat) => (
                <View key={cat.id}>
                  <Txt v="eyebrow" style={{ marginTop: 12, marginBottom: 4 }}>
                    {cat.label}
                  </Txt>
                  <View style={{ gap: 4 }}>
                    {cat.list.map((d) => {
                      const p = d.progress?.(s);
                      return (
                        <View
                          key={d.id}
                          testID={`title-locked-${d.id}`}
                          style={{
                            gap: 2,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            borderColor: c.line,
                            backgroundColor: c.surface2,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '700' }}>
                              {d.hidden ? '???' : d.name}
                            </Txt>
                            <Txt
                              tone="muted"
                              numberOfLines={1}
                              style={{ flex: 1, fontSize: rem(0.75) }}
                            >
                              {`${d.hidden ? L.hiddenDesc : d.desc} · ${RARITY_LABEL[d.rarity]}`}
                            </Txt>
                            {p && !d.hidden ? (
                              <Txt
                                tone="muted"
                                style={[num(400), { fontSize: rem(0.75) }]}
                              >{`${p[0]}/${p[1]}`}</Txt>
                            ) : null}
                          </View>
                          {p && !d.hidden ? (
                            <View
                              accessibilityRole="progressbar"
                              accessibilityLabel={L.progressLabel({ name: d.name })}
                              accessibilityValue={{ min: 0, max: p[1], now: p[0] }}
                              style={{
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: c.surface,
                                overflow: 'hidden',
                              }}
                            >
                              <View
                                style={{
                                  height: '100%',
                                  width: `${Math.round((p[0] / p[1]) * 100)}%`,
                                  backgroundColor: c.accent,
                                }}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </Card>
  );
}
