import { useState } from 'react';
import { View } from 'react-native';
import type { GameState } from '@offside/game/types';
import { careerDate, careerCalendar, careerScoring } from '@offside/app-core/careerOverview';
import { careerOverviewText as L } from '@offside/app-core/i18n/ko/careerOverview';
import { Card, Txt, Btn } from '../../ui';

export function CareerOverview({ s }: { s: GameState }) {
  const [calendar, setCalendar] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [key, setKey] = useState<'goals' | 'assists'>('goals');
  const rows = careerScoring(s, key);
  return (
    <Card gap={10}>
      <Txt v="h2" testID="career-date">
        {careerDate(s)}
      </Txt>
      <Btn onPress={() => setCalendar(!calendar)} accessibilityState={{ expanded: calendar }}>
        {L.calendarTitle}
      </Btn>
      {calendar ? (
        <View style={{ gap: 12 }}>
          <Txt tone="muted" v="sm">
            {L.calendarHint}
          </Txt>
          {careerCalendar(s).map((r) => (
            <View key={`${r.year}-${r.key}`} style={{ gap: 4 }}>
              <Txt bold>{r.title}</Txt>
              <Txt tone="muted" v="sm">
                {r.detail}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      <Btn onPress={() => setScoring(!scoring)} accessibilityState={{ expanded: scoring }}>
        {L.scoringTitle}
      </Btn>
      {scoring ? (
        rows ? (
          <View style={{ gap: 10 }}>
            <Txt tone="muted" v="sm">
              {L.scoringHint}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn
                kind={key === 'goals' ? 'tonal' : 'default'}
                onPress={() => setKey('goals')}
                accessibilityState={{ selected: key === 'goals' }}
              >
                {L.goalRank}
              </Btn>
              <Btn
                kind={key === 'assists' ? 'tonal' : 'default'}
                onPress={() => setKey('assists')}
                accessibilityState={{ selected: key === 'assists' }}
              >
                {L.assistRank}
              </Btn>
            </View>
            {rows.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Txt num style={{ width: 36 }}>
                  {L.rankLabel({ rank: r.rank })}
                </Txt>
                <Txt bold={r.me} style={{ flex: 1 }}>
                  {r.name}
                  {r.me ? ` · ${L.mine}` : ''}
                </Txt>
                <Txt num bold>
                  {String(r.value)}
                </Txt>
              </View>
            ))}
          </View>
        ) : (
          <Txt tone="muted" v="sm">
            {L.scoringLegacy}
          </Txt>
        )
      ) : null}
    </Card>
  );
}
