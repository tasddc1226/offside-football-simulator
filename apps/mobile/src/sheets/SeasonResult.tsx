// 시즌 결산 시트(웹 sheets/SeasonResult.svelte): 기록·수상·대회·국가대표·시상식·여정·새 칭호·팬 반응.
// 모션(CH 배지 팝, 스카우트 카드 팝, 팬 반응 순차 등장)은 웹 CSS 애니메이션 자리 — 동작 줄이기면 바로 보인다.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
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
          { key: 'apps', v: s.stats.apps, l: '출전' },
          { key: 'goals', v: s.stats.goals, l: '골' },
          { key: 'col', v: s.stats.col, l: s.stats.colLabel },
          { key: 'rating', v: s.stats.rating, l: '평점' },
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
        <Txt tone="muted">이번 시즌 수상은 없었어요.</Txt>
      )}
      {s.scout ? (
        <Pop ms={350} delay={160}>
          <View
            testID="scout-first"
            style={{
              gap: 2,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: mixColor(c.accent, c.surface, 12),
              borderWidth: 1,
              borderColor: alpha(c.accent, 0.5),
            }}
          >
            <Txt v="eyebrow">First Scouting Report</Txt>
            <Txt
              style={{ fontSize: rem(1.0625), fontWeight: '700', color: c.accentText }}
            >{`스카우트 잠재력 평가 ${s.scout}등급`}</Txt>
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              고3 시즌을 지켜본 스카우트의 첫 평가예요. 21·24세 재평가 때 좁혀져요.
            </Txt>
          </View>
        </Pop>
      ) : null}
      {s.comps.length ? (
        <View>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            대회별 성적
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
            국가대표 · 국제대회
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
            {"Ballon d'Or 시상식"}
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
            커리어 이정표
          </Txt>
          {s.miles.map((m, i) => (
            <Txt key={i}>{`· ${m}`}</Txt>
          ))}
        </View>
      ) : null}
      <NewTitles titles={s.titles} pop />
      {s.notes.length ? <Txt tone="muted">{s.notes.join(' · ')}</Txt> : null}
      <View>
        <Txt v="eyebrow" style={{ marginBottom: 6 }}>
          팬 반응
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
      <Txt tone="muted">{`${s.age}세가 됐어요. 이제 다음 시즌을 준비해요.`}</Txt>
    </>
  );
}
