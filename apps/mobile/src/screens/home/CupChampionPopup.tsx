// T-11-290 오프사이드 컵 우승 팝업(웹 cup/CupChampionPopup.svelte) — 앱을 켜 홈에 왔을 때 한 번, 가장 최근에 끝난 대회의
// 우승 팀(결승 뒤 일주일, 서버 champion). 홈 컵 배너와 같은 공개 응답(30초 메모)이라 요청이 늘지 않는다. '다시 보지 않기'는
// 대회 id로 기억한다(cupHome.ts). '우승 팀 보기'는 기록실 팀 프로필로 간다. 움직임 줄이기를 켰으면 바로 그린다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchCupHome, type CupChampion } from '@offside/app-core/api/cup';
import { cupChampionToShow, dismissCupChampion } from '@offside/app-core/cupHome';
import { claimHomePopup } from '@offside/app-core/homePopup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { divisionLabel } from '@offside/app-core/cupDivision';
import { hofStart } from '@offside/app-core/state';
import { TeamLogo } from '../../components/TeamLogo';
import { go } from '../../game/nav';
import { appState, prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { CupTrophy } from '../../ui/CupTrophy';
import { analyticsAskPending } from '../../components/AnalyticsAsk';
import { Btn, Press, Txt } from '../../ui';

// 한 번 띄운 뒤에는 앱을 다시 켤 때까지 홈에 다시 와도 띄우지 않는다(닫기만 눌렀으면 다음에 다시 켤 때 보인다).
let shownThisLaunch = false;

const COLORS = ['#f0b437', '#d99a12', '#e6ede7', '#7fc8a9', '#f26d6d', '#6ea8ff'];
const PIECES = Array.from({ length: 14 }, (_, i) => ({
  x: 4 + ((i * 37) % 92),
  delay: (((i * 53) % 10) / 12) * 1000,
  rotate: ((i * 71) % 180) - 90,
  color: COLORS[i % COLORS.length]!,
}));

export function CupChampionPopup() {
  const [champion, setChampion] = useState<CupChampion | null>(null);
  const [noMore, setNoMore] = useState(false);
  useEffect(() => {
    if (shownThisLaunch) return;
    let alive = true;
    void fetchCupHome().then((r) => {
      // T-11-417 이용 분석 동의 창이 떠 있으면 이번 실행에는 띄우지 않는다(iOS는 창 두 개를 함께 띄우지 못한다).
      if (!alive || !r.ok || shownThisLaunch || analyticsAskPending()) return;
      const next = cupChampionToShow(r.data);
      // T-11-423 제휴 팝업이 먼저 떴으면 이번 실행에는 띄우지 않는다.
      if (next && claimHomePopup()) {
        shownThisLaunch = true;
        setChampion(next);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!champion) return null;

  const close = () => {
    if (noMore) dismissCupChampion(champion.cupId);
    setChampion(null);
  };
  const openTeam = () => {
    const { teamId, season } = champion;
    close();
    appState.hof = { ...hofStart(), tab: 'teams', team: teamId, season };
    go('hof');
  };
  return (
    <Body
      champion={champion}
      noMore={noMore}
      setNoMore={setNoMore}
      close={close}
      openTeam={openTeam}
    />
  );
}

function Body({
  champion,
  noMore,
  setNoMore,
  close,
  openTeam,
}: {
  champion: CupChampion;
  noMore: boolean;
  setNoMore: (v: boolean) => void;
  close: () => void;
  openTeam: () => void;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const card = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const trophy = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const text = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const fall = useRef(PIECES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!motionOK) return;
    const ease = Easing.out(Easing.cubic);
    Animated.sequence([
      Animated.timing(card, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.timing(trophy, {
      toValue: 1,
      duration: 720,
      delay: 120,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
    Animated.timing(text, {
      toValue: 1,
      duration: 420,
      delay: 380,
      easing: ease,
      useNativeDriver: true,
    }).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    const confetti = Animated.parallel(
      fall.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 2600,
          delay: PIECES[i]!.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    confetti.start();
    return () => {
      pulse.stop();
      confetti.stop();
    };
  }, [motionOK, card, trophy, text, glow, fall]);

  const rise = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  });
  return (
    <Modal
      visible
      transparent
      animationType={motionOK ? 'fade' : 'none'}
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable
          accessibilityLabel={L.championPopupClose}
          onPress={close}
          style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }}
        />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={L.championPopupAria}
          testID={`cup-champion-popup-${champion.cupId}`}
          style={{
            width: '100%',
            maxWidth: 400,
            overflow: 'hidden',
            alignItems: 'center',
            gap: 10,
            padding: 20,
            paddingTop: 22,
            borderRadius: RADIUS.lg,
            backgroundColor: c.surface,
            opacity: card,
            transform: [
              { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
              { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -60,
              width: 320,
              height: 320,
              borderRadius: RADIUS.pill,
              backgroundColor: alpha('#f0b437', 0.18),
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
              transform: [
                { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) },
              ],
            }}
          />
          {motionOK
            ? PIECES.map((p, i) => (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: `${p.x}%`,
                    width: 7,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: p.color,
                    opacity: fall[i]!.interpolate({
                      inputRange: [0, 0.1, 1],
                      outputRange: [0, 1, 0],
                    }),
                    transform: [
                      {
                        translateY: fall[i]!.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 460],
                        }),
                      },
                      {
                        rotate: fall[i]!.interpolate({
                          inputRange: [0, 1],
                          outputRange: [`${p.rotate}deg`, `${p.rotate + 300}deg`],
                        }),
                      },
                    ],
                  }}
                />
              ))
            : null}
          <Txt v="eyebrow">{L.championPopupEyebrow({ n: champion.edition })}</Txt>
          <Animated.View
            style={{
              opacity: trophy,
              transform: [
                { translateY: trophy.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) },
                { scale: trophy.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            }}
          >
            <CupTrophy
              stage="champion"
              edition={champion.edition}
              name={champion.owner}
              size={140}
            />
          </Animated.View>
          <Animated.View style={[{ alignItems: 'center', gap: 10, width: '100%' }, rise(text)]}>
            <Txt v="h2" center>
              {L.championPopupTitle({ n: champion.edition, d: divisionLabel(champion.division) })}
            </Txt>
            <View
              testID={`cup-champion-team-${champion.teamId}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                maxWidth: '100%',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: 'transparent',
                borderRadius: RADIUS.md,
                backgroundColor: c.surface2,
              }}
            >
              <TeamLogo logo={champion.logo} name={champion.name} size={40} decorative />
              <View style={{ flexShrink: 1 }}>
                <Txt bold>{champion.name}</Txt>
                <Txt v="sm" tone="muted">
                  {L.championPopupOwner({ owner: champion.owner })}
                </Txt>
              </View>
            </View>
            <Txt v="sm" tone="muted" center>
              {L.championPopupBody}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              <Btn kind="accent" onPress={openTeam} testID="cup-champion-team">
                {L.championPopupTeam}
              </Btn>
              <Btn onPress={close} testID="cup-champion-close">
                {L.championPopupClose}
              </Btn>
            </View>
            <Press
              accessibilityRole="checkbox"
              accessibilityState={{ checked: noMore }}
              accessibilityLabel={L.championPopupNoMore}
              testID="cup-champion-nomore"
              scale={1}
              onPress={() => setNoMore(!noMore)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                minHeight: 36,
                paddingHorizontal: 6,
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: noMore ? c.accent : c.muted,
                  backgroundColor: noMore ? c.accent : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {noMore ? (
                  <Txt v="xs" bold style={{ color: c.accentInk, lineHeight: 14 }}>
                    ✓
                  </Txt>
                ) : null}
              </View>
              <Txt v="sm" tone="muted">
                {L.championPopupNoMore}
              </Txt>
            </Press>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}
