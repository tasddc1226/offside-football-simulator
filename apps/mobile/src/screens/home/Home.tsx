// 홈(웹 Home.svelte — ui.ts renderHome() 포트): 전광판 · 히어로 · 라이브 현황 · 타일 · 명예의 전당 TOP 3 · 소식 · 푸터.
import { Linking, Platform, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { PHASES, LAST_PHASE, posLabel } from '@offside/game/data';
import { ovr } from '@offside/game/attributes';
import { homeText as L } from '@offside/app-core/i18n/ko/home';
import { homeMoreText } from '@offside/app-core/i18n/ko/homeMore';
import { ANDROID_TESTER_FORM_URL, DC_GALLERY_URL } from '@offside/app-core/links';
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
import { InboxButton } from '../../components/InboxButton';
import { tn } from '@offside/game/i18n/names';

export default function Home() {
  const s = useSnapshot(appState);
  const c = useColors();
  const G = s.G && !s.G.retired ? s.G : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Topbar right={<InboxButton />} />
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
                <Txt style={{ ...heroSub, color: alpha(c.onPitch, 0.8) }}>{L.currentSub}</Txt>
                <Txt style={{ ...heroB, color: c.onPitch }}>
                  <Txt style={{ ...heroName, color: c.onPitch }}>{G.name}</Txt>
                </Txt>
              </View>
              <Txt style={{ ...p, color: alpha(c.onPitch, 0.8) }}>
                {L.currentLine({ club: tn(G.club.name), age: G.age, pos: posLabel(G) })}
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
                {L.currentMeta({
                  year: G.year,
                  phase: PHASES[Math.min(G.phase, LAST_PHASE + 1)] ?? '',
                  ovr: ovr(appState.G!),
                })}
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
                  <Txt style={btnText(c.onPitch)}>{L.newCareer}</Txt>
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
                    {L.continueCareer({ name: G.name })}
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
                {[L.kickoffLine1, L.kickoffLine2, L.kickoffLine3].join('\n')}
              </Txt>
              <Txt style={{ ...p, color: alpha(c.onPitch, 0.8) }}>{L.kickoffSub}</Txt>
              <Btn kind="accent" block testID="new" onPress={goNew} style={{ marginTop: 18 }}>
                {L.kickoffBtn}
              </Btn>
            </View>
          </PitchCard>
        )}
        <PushOptInCard />
        {G && s.ownerConflict ? (
          <View testID="owner-conflict">
            <Card gap={8} style={{ borderWidth: 1, borderColor: alpha(c.warn, 0.45) }}>
              <Txt bold>{L.conflictTitle}</Txt>
              <Txt v="sm" tone="muted">
                {L.conflictBody({ name: G.name })}
              </Txt>
              <Row gap={8}>
                <Btn kind="accent" testID="adopt-career" onPress={adoptCareer}>
                  {L.conflictAdopt}
                </Btn>
                <Btn sm testID="keep-on-device" onPress={keepOnDevice}>
                  {L.conflictKeep}
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
          title={L.marketTitle}
          sub={L.marketSub}
          onPress={() => go('market')}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <HomeFirsts />
          <Tile
            testID="dex"
            eyebrow="Events"
            title={L.dexTitle}
            sub={homeMoreText.dexSubApp}
            onPress={() => go('dex')}
          />
        </View>
        {/* T-11-009 디시인사이드 마이너 갤러리로 가는 커뮤니티 타일. T-11-016 안드로이드 앱에선 반으로 나눠 옆에
            비공개 테스터 모집(구글 폼)을 둔다 — iOS 앱엔 다른 플랫폼 안내를 싣지 않고 두 칸 폭 그대로 둔다. */}
        {Platform.OS === 'android' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Tile
              testID="dc-gallery"
              eyebrow="Community"
              title={L.galleryTitle}
              sub={L.gallerySub}
              onPress={() => void Linking.openURL(DC_GALLERY_URL)}
            />
            <Tile
              testID="android-tester"
              eyebrow="Android"
              title={L.testerTitle}
              sub={L.testerSub}
              onPress={() => void Linking.openURL(ANDROID_TESTER_FORM_URL)}
            />
          </View>
        ) : (
          <Tile
            wide
            testID="dc-gallery"
            eyebrow="Community"
            title={homeMoreText.galleryWideTitle}
            sub={homeMoreText.galleryWideSub}
            onPress={() => void Linking.openURL(DC_GALLERY_URL)}
          />
        )}
        <HallOfFame />
        <HomeNews board="notice" eyebrow="Notice" title={L.noticeTitle} />
        <HomeNews board="release" eyebrow="Release notes" title={L.releaseTitle} />
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
      accessibilityLabel={homeMoreText.chatLabelApp}
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
