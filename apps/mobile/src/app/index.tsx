// T-11-004 뼈대 확인용 홈: 공용 엔진으로 새 선수를 만들어 세이브에 넣고 다시 읽는다. T-11-005에서 실제 홈으로 바꾼다.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { newGame } from '@offside/game/engine';
import { createRng, freshSeed, setActiveRng } from '@offside/game/rng';
import { loadKey } from '@offside/game/season';
import { saveGame } from '@offside/app-core/career';
import type { GameState } from '@offside/game/types';
import { useColors } from '../theme/useColors';

export default function Home() {
  const c = useColors();
  const [g, setG] = useState(() => loadKey<GameState>('ft_save'));

  function start() {
    const seed = freshSeed();
    setActiveRng(createRng(seed));
    const next = newGame(
      { name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      seed,
    );
    saveGame(next);
    setG(next);
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.hero, { backgroundColor: c.pitch }]}>
          <Text style={[styles.brand, { color: c.pitchAccent }]}>OFFSIDE</Text>
          <Text style={[styles.sub, { color: c.onPitch }]}>이번 생은 축구다</Text>
        </View>
        <Text style={{ color: c.ink }}>
          {g
            ? `${g.name} · ${g.age}세 · ${g.club.name} (${g.cid.slice(0, 8)})`
            : '진행 중인 커리어가 없어요.'}
        </Text>
        <Pressable
          onPress={start}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: c.accentInk }]}>새 커리어 시작</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: 16, gap: 16 },
  hero: { borderRadius: 16, padding: 24, gap: 4 },
  brand: { fontSize: 36, fontWeight: '800', letterSpacing: 2 },
  sub: { fontSize: 15 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
});
