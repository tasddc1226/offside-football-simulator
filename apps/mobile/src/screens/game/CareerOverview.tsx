import { useState } from 'react';
import { View } from 'react-native';
import type { GameState } from '@offside/game/types';
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import {
  careerCalendarYears,
  careerScoring,
  calendarSummary,
  scoringSummary,
  scoringNotStarted,
} from '@offside/app-core/careerOverview';
import { careerOverviewText as L } from '@offside/app-core/i18n/ko/careerOverview';
import { Card, Txt, Press, Pill, Opt } from '../../ui';
import { Chevron } from '../../ui/Disclosure';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';

const TONE = { qualified: 'good', eliminated: 'bad', pending: undefined } as const;

/** 접힘 줄: 왼쪽 제목, 오른쪽 요약 + 셰브론(웹 summary.disc-row + .peek). */
function PeekRow({
  open,
  onToggle,
  label,
  peek,
  testID,
  last,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  peek: string;
  testID: string;
  last?: boolean;
}) {
  const c = useColors();
  return (
    <Press
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}, ${peek}`}
      testID={testID}
      style={{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: c.line,
        ...(last && !open ? { borderBottomWidth: 1, borderBottomColor: c.line } : null),
      }}
    >
      <Txt bold>{label}</Txt>
      <Txt
        tone="muted"
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'right', fontSize: rem(FONT.caption), fontWeight: '600' }}
      >
        {peek}
      </Txt>
      <Chevron open={open} />
    </Press>
  );
}

export function CareerOverview({ s }: { s: GameState }) {
  const c = useColors();
  const [calendar, setCalendar] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [key, setKey] = useState<'goals' | 'assists'>('goals');
  const rows = careerScoring(s, key);
  const empty = scoringNotStarted(s);
  const small = { fontSize: rem(FONT.caption), fontWeight: '700' } as const;
  return (
    <Card gap={10}>
      <Txt v="h2" testID="career-date">
        {L.cardTitle}
      </Txt>
      <View>
        <PeekRow
          open={calendar}
          onToggle={() => setCalendar(!calendar)}
          label={L.calendarTitle}
          peek={calendarSummary(s)}
          testID="career-calendar-toggle"
        />
        {calendar ? (
          <View style={{ gap: 12, paddingBottom: 14 }}>
            <Txt tone="muted" v="sm">
              {L.calendarHint}
            </Txt>
            {careerCalendarYears(s).map((y) => (
              <View
                key={y.year}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  paddingLeft: 10,
                  borderLeftWidth: 2,
                  borderLeftColor: y.current ? c.accent : c.line,
                }}
              >
                <Txt num style={{ ...small, width: 72, color: y.current ? c.accent : c.muted }}>
                  {y.head}
                </Txt>
                <View style={{ flex: 1, gap: 10 }}>
                  {y.items.map((r) => (
                    <View key={r.key} style={{ gap: 3, alignItems: 'flex-start' }}>
                      <Txt bold>{r.title}</Txt>
                      <Txt tone="muted" v="sm">
                        {r.detail}
                      </Txt>
                      {r.status ? <Pill tone={TONE[r.status]}>{r.statusText}</Pill> : null}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <PeekRow
          open={scoring}
          onToggle={() => setScoring(!scoring)}
          label={L.scoringTitle}
          peek={scoringSummary(s)}
          testID="career-scoring-toggle"
          last
        />
        {scoring ? (
          <View
            style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.line }}
          >
            {rows ? (
              <>
                <Txt tone="muted" v="sm">
                  {L.scoringHint}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['goals', 'assists'] as const).map((k) => (
                    <View key={k} style={{ flex: 1 }}>
                      <Opt
                        selected={key === k}
                        onPress={() => setKey(k)}
                        style={{ alignItems: 'center' }}
                      >
                        <Txt bold>{k === 'goals' ? L.goalRank : L.assistRank}</Txt>
                      </Opt>
                    </View>
                  ))}
                </View>
                {empty ? (
                  <View
                    style={{ padding: 14, borderRadius: RADIUS.md, backgroundColor: c.surface2 }}
                  >
                    <Txt tone="muted" v="sm" style={{ textAlign: 'center' }}>
                      {L.scoringEmpty}
                    </Txt>
                  </View>
                ) : (
                  <View>
                    {rows.map((r, i) => (
                      <View key={r.id}>
                        {r.gap ? (
                          <Txt tone="muted" style={{ textAlign: 'center' }}>
                            …
                          </Txt>
                        ) : null}
                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 8,
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 6,
                            borderTopWidth: i && !r.gap && !r.me ? 1 : 0,
                            borderTopColor: c.line,
                            ...(r.me
                              ? { borderRadius: RADIUS.sm, backgroundColor: alpha(c.accent, 0.12) }
                              : null),
                          }}
                        >
                          <Txt
                            num
                            style={{ ...small, width: 40, color: r.me ? c.accent : c.muted }}
                          >
                            {L.rankLabel({ rank: r.rank })}
                          </Txt>
                          <Txt bold={r.me} style={{ flex: 1 }}>
                            {r.name}
                            {r.me ? (
                              <Txt style={{ color: c.accent, fontSize: rem(FONT.caption) }}>
                                {` ${L.mine}`}
                              </Txt>
                            ) : null}
                          </Txt>
                          <Txt num bold>
                            {String(r.value)}
                          </Txt>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Txt tone="muted" v="sm">
                {L.scoringLegacy}
              </Txt>
            )}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
