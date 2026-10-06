// 시즌 결산 시트(웹 sheets/SeasonResult.svelte): 기록·수상·대회·국가대표·시상식·여정·새 칭호·팬 반응.
// 모션(CH 배지 팝, 스카우트 카드 팝, 팬 반응 순차 등장)은 웹 CSS 애니메이션 자리 — 동작 줄이기면 바로 보인다.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { visibleSeasonNotes } from '@offside/app-core/potential-view';
import type { SheetView } from '@offside/app-core/sheets';
import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
import { NewTitles } from '../screens/game/NewTitles';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';
import { Enter, Pop } from './anim';
import { Hl, StatGrid, mixColor } from './parts';

export function SeasonResult({ v }: { v: Extract<SheetView, { kind: 'season' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const notes = visibleSeasonNotes(s.notes);
  return (
    <>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.title}
      </Txt>
      {s.ch.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {s.ch.map((x, i) => (
            <Pop key={i} from={0.4} ms={340} delay={120 + i * 90}>
              <View
                style={{
                  paddingVertical: 2,
                  paddingHorizontal: 6,
                  borderRadius: 999,
                  backgroundColor: mixColor(c.accent, c.surface, 22),
                  borderWidth: 1,
                  borderColor: alpha(c.accent, 0.55),
                }}
              >
                <Txt
                  style={{
                    fontSize: rem(0.625),
                    fontWeight: '700',
                    letterSpacing: rem(0.625) * 0.04,
                    color: c.accentText,
                  }}
                >{`CH · ${x}`}</Txt>
              </View>
            </Pop>
          ))}
        </View>
      ) : null}
      <StatGrid
        mt={14}
        items={[
          { key: 'apps', v: s.stats.apps, l: sheetCoreText.tallyApps },
          { key: 'goals', v: s.stats.goals, l: sheetCoreText.tallyGoals },
          { key: 'col', v: s.stats.col, l: s.stats.colLabel },
          { key: 'rating', v: s.stats.rating, l: sheetCoreText.tallyRating },
        ]}
      />
      {s.honors.length ? (
        <View style={{ gap: 10 }}>
          {s.honors.map((t, i) => (
            <Hl key={i}>
              <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>{t}</Txt>
            </Hl>
          ))}
        </View>
      ) : (
        <Txt tone="muted">{L.noHonors}</Txt>
      )}
      {s.promo ? (
        <Pop from={0.4} ms={400} delay={160}>
          <View
            style={{
              gap: 4,
              padding: 12,
              borderRadius: 12,
              backgroundColor: mixColor(c.accent, c.surface, 14),
              borderWidth: 1,
              borderColor: alpha(c.accent, 0.55),
            }}
          >
            <Txt v="eyebrow">Promotion</Txt>
            <Txt bold style={{ color: c.accentText }}>
              {L.promoTitle}
            </Txt>
            <Txt v="sm" tone="muted">
              {L.promoBodyApp({ club: s.promo.club })}
            </Txt>
            <Txt v="xs" tone="muted">
              {L.promoDownApp({ club: s.promo.down })}
            </Txt>
          </View>
        </Pop>
      ) : null}
      {s.comps.length ? (
        <View>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            {L.comps}
          </Txt>
          {s.comps.map((x, i) => (
            <Txt key={i} tone="muted">
              {x}
            </Txt>
          ))}
        </View>
      ) : null}
      {s.tours.length ? (
        <View>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            {L.tours}
          </Txt>
          {s.tours.map((x, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Txt>
                <Txt style={{ fontWeight: '700' }}>{x.name}</Txt>
                {` — ${x.stage}`}
                {x.note ? <Txt tone="muted">{`  (${x.note})`}</Txt> : null}
              </Txt>
              {x.lines.map((l, j) => (
                <Txt key={j} v="xs" tone="muted">
                  {l}
                </Txt>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {s.gala.length ? (
        <View style={{ gap: 0 }}>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            {L.gala}
          </Txt>
          {s.gala.map((g, i) => (
            <Hl key={i}>
              <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>{g}</Txt>
            </Hl>
          ))}
        </View>
      ) : null}
      {s.miles.length ? (
        <View>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            {L.miles}
          </Txt>
          {s.miles.map((m, i) => (
            <Txt key={i}>{`· ${m}`}</Txt>
          ))}
        </View>
      ) : null}
      <NewTitles titles={s.titles} pop />
      {notes.length ? <Txt tone="muted">{notes.join(' · ')}</Txt> : null}
      {s.scoutHint ? (
        <View>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            {L.scoutHint}
          </Txt>
          <Txt>{`“${s.scoutHint}”`}</Txt>
        </View>
      ) : null}
      <View>
        <Txt v="eyebrow" style={{ marginBottom: 6 }}>
          {L.fans}
        </Txt>
        <View style={{ gap: 6 }}>
          {s.fans.map((f, i) => (
            <Enter key={i} kind="translateX" from={-14} ms={320} delay={200 + i * 110}>
              <View
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: c.surface2,
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                <Txt style={{ fontSize: rem(0.8125) }}>
                  <Txt accessibilityElementsHidden style={{ fontSize: rem(0.8125) }}>
                    {'💗 '}
                  </Txt>
                  {f}
                </Txt>
              </View>
            </Enter>
          ))}
        </View>
      </View>
      <Txt tone="muted">{L.ageApp({ age: s.age })}</Txt>
    </>
  );
}
