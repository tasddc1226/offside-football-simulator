import { View } from 'react-native';
import type { CupMatch } from '@offside/app-core/api/cup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { Pill, Txt } from '../../ui';

export default function CupMatchStatus({ m }: { m: CupMatch }) {
  if (m.played) return <Pill tone="good">{L.matchFinished}</Pill>;
  if (m.at <= new Date().toISOString()) return <Pill tone="warn">{L.matchProcessing}</Pill>;
  return (
    <View
      style={{
        alignSelf: 'center',
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderWidth: 1,
        borderColor: '#60a5fa',
        backgroundColor: '#1d4ed8',
      }}
    >
      <Txt v="xs" bold style={{ color: '#fff' }}>
        {L.matchScheduled}
      </Txt>
    </View>
  );
}
