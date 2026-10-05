// 홈(웹 Home.svelte — ui.ts renderHome() 포트): 전광판 · 히어로 · 라이브 현황 · 타일 · 명예의 전당 TOP 3 · 소식 · 푸터.
import { Linking, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { PHASES, LAST_PHASE, posLabel } from '@offside/game/data';
import { ovr } from '@offside/game/attributes';
import { withRo } from '@offside/app-core/format';
import { DC_GALLERY_URL } from '@offside/app-core/links';
import { HallOfFame } from '../../components/HallOfFame';
import { SiteFooter } from '../../components/SiteFooter';
import { adoptCareer, keepOnDevice } from '../../game/host';
import { go, goContinue, goNew } from '../../game/nav';
import { appState } from '../../store';
import { alpha } from '../../theme/colors';
import { num, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, PitchCard, Press, Row, Screen, Topbar, Txt } from '../../ui';
import { HomeFirsts } from './HomeFirsts';
import { HomeLive } from './HomeLive';
import { HomeNews } from './HomeNews';
import { HomeTicker } from './HomeTicker';
import { Tile } from './Tile';
import { PushOptInCard } from './PushOptInCard';

export default function Home() {
  const s = useSnapshot(appState);
  const c = useColors();
  const G = s.G && !s.G.retired ? s.G : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Topbar />
        {/* 이적·서버 최초 기록이 흐르는 전광판 */}
        <HomeTicker />
        {G ? (
          // 진행 중인 커리어가 있으면 첫 카드를 '이번 커리어'로 바꿔 이어하기를 가장 먼저 보여 준다.
          <PitchCard>
            <View testID="home-current">
              <Txt v="eyebrow" style={{ color: alpha(c.onPitch, 0.7) }}>
                Current career
              </Txt>
              <View style={{ marginTop: 6, gap: 2 }} accessible accessibilityRole="header">
                <Txt style={{ ...heroSub, color: alpha(c.onPitch, 0.8) }}>진행 중인 커리어</Txt>
                <Txt style={{ ...heroB, color: c.onPitch }}>
                  <Txt style={{ ...heroName, color: c.onPitch }}>{G.name}</Txt>
                </Txt>
              </View>
              <Txt style={{ ...p, color: alpha(c.onPitch, 0.8) }}>
                {G.club.name} · {G.age}세 · {posLabel(G)}
              </Txt>
              <Txt
                style={[
                  num(700),
                  {
                    fontSize: rem(0.8125),
                    lineHeight: rem(0.8125) * 1.5,
                    marginTop: 2,
                    color: alpha(c.onPitch, 0.65),
                  },
                ]}
              >
                {G.year} 시즌 {PHASES[Math.min(G.phase, LAST_PHASE + 1)]} · OVR {ovr(appState.G!)}
              </Txt>
              {/* 한 줄에 왼쪽 새 커리어, 오른쪽 이어하기(주 버튼이라 더 넓게). */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                <Btn
                  testID="new"
                  onPress={goNew}
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: alpha(c.onPitch, 0.35),
                    paddingHorizontal: 14,
                  }}
                >
                  <Txt style={btnText(c.onPitch)}>새 커리어 시작</Txt>
                </Btn>
                <Btn
                  kind="accent"
                  testID="continue"
                  onPress={goContinue}
                  style={{ flex: 1, minWidth: 0, paddingHorizontal: 14 }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Circle
                      cx={12}
                      cy={12}
                      r={9}
                      fill="none"
                      stroke={c.accentInk}
                      strokeWidth={2}
                    />
                    <Path d="m10 7.8 6 4.2-6 4.2Z" fill={c.accentInk} />
                  </Svg>
                  <Txt numberOfLines={1} style={{ ...btnText(c.accentInk), flexShrink: 1 }}>
                    {withRo(G.name)} 계속 →
                  </Txt>
                </Btn>
              </View>
            </View>
          </PitchCard>
        ) : (
          <PitchCard>
            <View>
              <Txt v="eyebrow" style={{ color: alpha(c.onPitch, 0.7) }}>
                Kick-off · 0′
              </Txt>
              <Txt
                v="h1"
                accessibilityRole="header"
                style={{
                  fontSize: rem(1.875),
                  lineHeight: rem(1.875) * 1.25,
                  marginTop: 6,
                  color: c.onPitch,
                }}
              >
                {'이번 생은 축구다\n고3부터 은퇴까지,\n한 선수로 살아요'}
              </Txt>
              <Txt style={{ ...p, color: alpha(c.onPitch, 0.8) }}>
                훈련·이적·이벤트에서 고른 선택으로 커리어가 달라져요.
              </Txt>
              <Btn kind="accent" block testID="new" onPress={goNew} style={{ marginTop: 18 }}>
                새 커리어 킥오프 →
              </Btn>
            </View>
          </PitchCard>
        )}
        <PushOptInCard />
        {G && s.ownerConflict ? (
          <View testID="owner-conflict">
            <Card gap={8} style={{ borderWidth: 1, borderColor: alpha(c.warn, 0.45) }}>
              <Txt bold>이 커리어는 다른 계정에 기록돼 있어요</Txt>
              <Txt v="sm" tone="muted">
                로그인한 계정이 바뀌어서 {G.name} 선수의 기록이 서버에 저장되지 않고 있어요. 원래
                계정으로 다시 로그인하면 그대로 이어져요.
              </Txt>
              <Row gap={8}>
                <Btn kind="accent" testID="adopt-career" onPress={adoptCareer}>
                  지금 계정으로 이어서 기록
                </Btn>
                <Btn sm testID="keep-on-device" onPress={keepOnDevice}>
                  이 기기에만 두기
                </Btn>
              </Row>
            </Card>
          </View>
        ) : null}
        <HomeLive />
        {/* T-11-080f 구단주 화면을 거치지 않고 이적시장으로 바로 간다(뒤로 가기는 홈으로). 홈에서는 서버를 부르지 않는다. */}
        <Tile
          wide
          testID="home-market"
          eyebrow="Transfer market"
          title="이적시장"
          sub="이번 시즌 선수 사고팔기 · 시세 →"
          onPress={() => go('market')}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <HomeFirsts />
          <Tile
            testID="dex"
            eyebrow="Events"
            title="확률 이벤트"
            sub="선택지마다 성공 확률 공개 · 확률 도감 보기 →"
            onPress={() => go('dex')}
          />
        </View>
        {/* T-11-009 디시인사이드 마이너 갤러리로 가는 커뮤니티 타일. T-11-095 Android 정식 출시로 옆의 테스터 모집을 걷었다. */}
        <Tile
          wide
          testID="dc-gallery"
          eyebrow="Community"
          title="오프사이드 마이너 갤러리 ↗"
          sub="디시인사이드에서 커리어 자랑 · 공략 · 건의 나누기"
          onPress={() => void Linking.openURL(DC_GALLERY_URL)}
        />
        <HallOfFame />
        <HomeNews board="notice" eyebrow="Notice" title="공지사항" />
        <HomeNews board="release" eyebrow="Release notes" title="릴리즈 노트" />
        <SiteFooter />
      </Screen>
      <ChatFab />
    </View>
  );
}

/** T-11-015 라운지 채팅으로 가는 떠 있는 버튼(웹 .chat-fab) — 하단 메뉴 바로 위 오른쪽. */
function ChatFab() {
  const c = useColors();
  return (
    <Press
      testID="chat-fab"
      accessibilityRole="button"
      accessibilityLabel="라운지 채팅"
      onPress={() => go('chat')}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: c.accent,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"
          fill={c.accentInk}
        />
      </Svg>
    </Press>
  );
}

// 웹 .hero-home p · .hero-current h1 (span · b · strong)
const p = { fontSize: rem(1), lineHeight: rem(1) * 1.55, marginTop: 6, maxWidth: 250 };
const heroSub = {
  fontSize: rem(1.0625),
  lineHeight: rem(1.0625) * 1.25,
  fontWeight: '600' as const,
};
const heroB = { fontSize: rem(1.375), lineHeight: rem(2) * 1.25, fontWeight: '600' as const };
const heroName = { fontSize: rem(2), lineHeight: rem(2) * 1.25, fontWeight: '700' as const };
const btnText = (color: string) => ({
  color,
  fontSize: rem(0.9375),
  fontWeight: '600' as const,
  lineHeight: rem(0.9375) * 1.25,
});
