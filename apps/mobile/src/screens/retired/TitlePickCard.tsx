import { retiredTitleOf } from '@offside/app-core/retiredTitle';
// 은퇴한 내 선수의 대표 칭호 고르기(웹 titles/TitlePickCard.svelte; 은퇴 화면·내 선수 상세 아래). 받은 칭호 목록은 접어
// 두고, 펼쳐서 고르면 선수 카드·명예의 전당·공유 링크의 대표 칭호가 바뀐다. 이 기기 기록(ft_hof)에 남기고 서버에 다시
// 올린다 — 서버는 은퇴 때 올라온 상세 기록의 칭호 목록에 있는 것만 받는다.
import { useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { loadHOF } from '@offside/game/hof-store';
import { saveKey } from '@offside/game/storage';
import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';
import { titleById } from '@offside/game/titles';
import type { HofEntry } from '@offside/game/types';
import { earnedTitles } from '@offside/app-core/legendReport';
import { titleText as L } from '@offside/app-core/i18n/ko/title';
import { TitleTag } from '../../components/TitleTag';
import { toast, uploadRetirement } from '../../game/host';
import { rnResults } from '../../store';
import { pickedTitles } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { liveEntry } from './own';

export function TitlePickCard({ h }: { h: HofEntry }) {
  const c = useColors();
  const pk = useSnapshot(pickedTitles);
  const results = useSnapshot(rnResults);
  const earned = earnedTitles(h, h.id && h.id in results ? results[h.id] : null);
  const current = titleById(retiredTitleOf(h.id ?? '', h.title, pk));
  const [open, setOpen] = useState(false);

  function pick(id: string) {
    setOpen(false);
    if (!h.id) return;
    pickedTitles[h.id] = id;
    liveEntry(h).title = id;
    const hof = loadHOF();
    const saved = hof.find((x) => x.id === h.id);
    if (saved) saved.title = id;
    saveKey('ft_hof', hof);
    uploadRetirement(h.id, liveEntry(h));
    toast(L.pickChanged({ name: titleById(id)?.name ?? id }));
  }

  if (earned.length <= 1 && !earned.some((x) => x.d.id === WALL_OF_HONOR_TITLE_ID)) return null;
  return (
    <Card>
      <View testID="legend-titles">
        <Txt v="eyebrow">Titles</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.mainTitle}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {current ? (
          <TitleTag name={current.name} rarity={current.rarity} />
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
            {L.none}
          </Txt>
        )}
      </View>
      <Press
        scale={0.985}
        testID="legend-title-open"
        onPress={() => setOpen(!open)}
        accessibilityState={{ expanded: open }}
        style={{ paddingVertical: 4 }}
      >
        <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
          {`${open ? '▾' : '▸'} ${L.pickOpen({ n: earned.length })}`}
        </Txt>
      </Press>
      {open ? (
        <View style={{ gap: 6 }}>
          {earned.map((x) => {
            const on = current?.id === x.d.id;
            return (
              <Press
                key={x.d.id}
                scale={0.985}
                testID={`legend-title-pick-${x.d.id}`}
                onPress={() => pick(x.d.id)}
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: on ? 7.5 : 8,
                  paddingHorizontal: on ? 9 : 10,
                  borderRadius: 10,
                  borderWidth: on ? 2.5 : 1.5,
                  borderColor: on ? c.accent : c.line,
                  backgroundColor: c.surface,
                }}
              >
                <TitleTag name={x.d.name} rarity={x.d.rarity} />
                <Txt
                  tone="muted"
                  style={{ flex: 1, fontSize: rem(0.75), lineHeight: rem(0.75) * 1.5 }}
                >
                  {x.d.desc}
                </Txt>
                <Txt tone="muted" style={{ fontFamily: DISPLAY[700], fontSize: rem(0.75) }}>
                  {x.d.id === WALL_OF_HONOR_TITLE_ID ? L.retiredYear : x.year ? x.year : L.earlier}
                </Txt>
              </Press>
            );
          })}
        </View>
      ) : null}
      <Txt v="xs" tone="muted">
        {L.pickNote}
      </Txt>
    </Card>
  );
}
