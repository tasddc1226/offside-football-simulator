// T-11-128 결산 카드 흐름(웹 RecapCardReel.svelte) — 키운 선수 카드가 왼쪽에서 오른쪽으로 끝없이 흐른다.
// 손가락으로 넘기면 멈췄다가 잠시 뒤 다시 흐른다. 끝없이 보이도록 카드를 두 번 이어 붙이고(두 번째 줄은 화면 읽기에서
// 숨긴다), 반 바퀴마다 위치를 되돌린다. 동작 줄이기거나 카드가 화면을 못 채우면 흐르지 않고 그냥 가로로 넘겨 본다.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView } from 'react-native';
import { useSnapshot } from 'valtio';
import type { RecapSquadMember } from '@offside/contracts';
import { detailPosOf } from '@offside/contracts/positions';
import { playerName } from '@offside/app-core/format';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { PlayerCard } from '../../../components/PlayerCard';
import { prefs } from '../../../store';

/** 1초에 움직이는 px. */
const SPEED = 28;
/** 손을 뗀 뒤 다시 흐르기까지(ms). */
const RESUME = 2500;
/** 카드 폭 · 카드 사이 간격(웹 .reel-card · .reel-track). 한 벌의 폭 = 카드 수 × (폭 + 간격). */
const CARD_W = 132;
const GAP = 10;
/** 바깥 카드 안쪽 여백(Card padding 18)까지 가로로 넘치게 펴는 값. */
const BLEED = 18;

/** 카드 한 장 — 웹 PlayerCard(이름 · OVR · 자리 · 시즌)와 같은 값을 모바일 카드 데이터로 옮긴다. */
const ReelCard = memo(function ReelCard({ m }: { m: RecapSquadMember }) {
  const { card } = m;
  return (
    <View style={{ width: CARD_W }}>
      <PlayerCard
        animate={false}
        code={detailPosOf(card)}
        cell={{
          name: playerName(card.publicName, card.pos, card.number),
          nation: card.nation,
          season: card.season,
          rating: card.peak,
          number: card.number,
          legendScore: card.legendScore,
          attrs: card.attrs,
          attrsEstimated: card.attrsEstimated,
          height: card.height,
          weight: card.weight,
          cardValue: card.cardValue,
          pos: card.pos,
          youth: false,
        }}
      />
    </View>
  );
});

function Track({ squad, hidden }: { squad: readonly RecapSquadMember[]; hidden?: boolean }) {
  return (
    <View
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={{ flexDirection: 'row', gap: GAP, paddingRight: GAP }}
    >
      {squad.map((m) => (
        <ReelCard key={m.card.careerId} m={m} />
      ))}
    </View>
  );
}

export function RecapCardReel({ squad }: { squad: readonly RecapSquadMember[] }) {
  const { motionOK } = useSnapshot(prefs);
  const ref = useRef<ScrollView>(null);
  const [viewW, setViewW] = useState(0);
  // 한 벌(이어 붙이기 전)의 폭. 화면보다 넓을 때만 흐른다.
  const half = squad.length * (CARD_W + GAP);
  const loop = motionOK && viewW > 0 && half > viewW + 8;
  // 효과 안에서 최신 값을 읽는 상태(리렌더 없이 움직인다).
  const st = useRef({ pos: 0, holdUntil: 0 });

  // 켜지면 반 바퀴 지점에서 시작해 왼쪽 끝에 바로 닿지 않게 한다.
  useEffect(() => {
    if (!loop) return;
    st.current.pos = half;
    ref.current?.scrollTo({ x: half, animated: false });
  }, [loop, half]);

  useEffect(() => {
    if (!loop) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(64, t - last) : 0;
      last = t;
      const s = st.current;
      if (Date.now() < s.holdUntil || dt === 0) return;
      // 왼쪽에서 오른쪽으로 흐르게 스크롤을 줄인다(0에 닿으면 반 바퀴 뒤로).
      s.pos -= (SPEED * dt) / 1000;
      if (s.pos <= 0) s.pos += half;
      ref.current?.scrollTo({ x: s.pos, animated: false });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, half]);

  const handlers = useMemo(() => {
    const hold = (ms: number) => (st.current.holdUntil = Date.now() + ms);
    return {
      // 손을 대고 있거나 관성으로 밀리는 동안은 멈춰 둔다.
      onScrollBeginDrag: () => hold(1e9),
      onScrollEndDrag: () => hold(RESUME),
      onMomentumScrollBegin: () => hold(1e9),
      onMomentumScrollEnd: () => hold(RESUME),
    };
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const s = st.current;
    const x = e.nativeEvent.contentOffset.x;
    // 손으로 넘기는 중일 때만 그 위치를 이어받는다(우리가 움직인 스크롤은 무시).
    if (Date.now() >= s.holdUntil) return;
    s.pos = x;
    if (!loop) return;
    // 양 끝에 닿으면 반 바퀴 되돌려 끝없이 넘긴다.
    if (x <= 0) {
      s.pos = x + half;
      ref.current?.scrollTo({ x: s.pos, animated: false });
    } else if (x >= BLEED + half * 2 - viewW - 1) {
      s.pos = x - half;
      ref.current?.scrollTo({ x: s.pos, animated: false });
    }
  };

  return (
    <ScrollView
      ref={ref}
      testID="recap-reel"
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={L.reelAria}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
      {...handlers}
      // 카드 안쪽 여백만큼 양옆으로 펴서 화면 끝까지 흐르게 한다(웹 margin-inline: -16px).
      style={{ marginHorizontal: -BLEED, flexGrow: 0 }}
      contentContainerStyle={{ paddingLeft: BLEED, paddingVertical: 6, flexDirection: 'row' }}
    >
      <Track squad={squad} />
      {loop ? <Track squad={squad} hidden /> : null}
    </ScrollView>
  );
}
