import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { Txt } from '../ui/Txt';
import { Steps } from './Steps';
import { Block } from './Block';
import { SkipLink } from './parts';

export function ProgressScene({ v }: { v: Extract<SheetView, { kind: 'steps' | 'block' }> }) {
  const s = useSnapshot(v);
  const { height } = useWindowDimensions();
  return (
    <>
      <View
        style={{
          flex: 1,
          gap: 18,
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          justifyContent: 'space-between',
        }}
        testID="progress-scene"
      >
        <View style={{ paddingHorizontal: 20, gap: 4 }}>
          {s.kind === 'block' ? <Txt v="eyebrow">{s.eyebrow}</Txt> : null}
          <Txt v="h2" accessibilityRole="header">
            {s.title}
          </Txt>
        </View>
        <ScrollView
          style={{
            flexGrow: 0,
            maxHeight: height <= 540 ? 70 : Math.min(200, height * 0.24),
          }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 6, gap: 12 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Txt style={{ flex: 1 }} accessibilityLiveRegion="polite">
              {s.kind === 'block'
                ? s.round
                : s.steps[Math.min(Math.max(s.active, 0), s.steps.length - 1)]}
            </Txt>
            <Txt bold>{Math.round(s.progress * 100)}%</Txt>
          </View>
          {v.kind === 'steps' ? <Steps v={v} compact /> : <Block v={v} compact />}
        </ScrollView>
      </View>
      {s.kind === 'block' && s.skip ? (
        <View style={{ paddingHorizontal: 20 }}>
          <SkipLink
            onPress={() => {
              if (v.kind === 'block') v.skip?.();
            }}
          />
        </View>
      ) : null}
    </>
  );
}
