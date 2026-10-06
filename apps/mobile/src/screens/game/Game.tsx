// 게임 화면(웹 Game.svelte, ui.ts renderGame() 포트): 선수 카드 + 시즌·선수·커리어·트로피 탭 + 아래 고정 진행 바와 탭바.
// 탭바(시즌·선수·홈·커리어·트로피 — 홈은 가운데)가 아래 안전 영역을 채우고, 진행 바는 그 바로 위에 붙는다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { posLabel } from '@offside/game/data';
import { ovr } from '@offside/game/attributes';
import { leagueOf, roleOf, fmtMoney, focusOf, labelOf } from '@offside/game/engine';
import { tn } from '@offside/game/i18n/names';
import { mainTitle } from '@offside/game/titles';
import { avatarSpec, avatarSvg } from '@offside/game/avatar';
import { marketValue } from '@offside/game/season';
import type { GameState } from '@offside/game/types';
import type { Tab } from '@offside/app-core/state';
import { fmtValue } from '@offside/app-core/format';
import { seasonAction } from '@offside/app-core/seasonAction';
import { gameText as T } from '@offside/app-core/i18n/ko/game';
import { playerNudgeText as PN } from '@offside/app-core/i18n/ko/playerNudge';
import { CareerTab } from '../../components/CareerTab';
import { advance, buzz, nextPending } from '../../game/host';
import { goHome } from '../../game/nav';
import { Enter } from '../../sheets/anim';
import { useTween } from '../../sheets/useTween';
import { appState, prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { ActionBar } from '../../ui/ActionBar';
import { Btn } from '../../ui/Btn';
import { PitchCard } from '../../ui/Card';
import { ClubBadge } from '../../ui/ClubBadge';
import { Press } from '../../ui/Press';
import { BarBelow, Screen } from '../../ui/Screen';
import { TabBar, type TabItem } from '../../ui/TabBar';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { scrollTo } from '../../ui/scroll';
import { PlayerTab } from './PlayerTab';
import { PlayerNudge } from './PlayerNudge';
import { notePlayerVisit, playerNudge } from '@offside/app-core/player-nudge';
import { peekOpen } from '@offside/app-core/potential-peek';
import { peekAvailable, potPeek } from '../../platform/rewardedPeek';
import { SeasonTab } from './SeasonTab';
import { TitleDex } from './TitleDex';
import { TrophyTab } from './TrophyTab';

/** 선수 카드 아래 알약(웹 .player .pill: 초록 바탕 위 반투명 흰 알약). fill이면 강조색으로 채운다. */
function HeroPill({
  children,
  fill,
  danger,
}: {
  children: string;
  fill?: 'accent';
  danger?: boolean;
}) {
  const c = useColors();
  const bg = danger ? c.bad : fill === 'accent' ? c.accent : 'rgba(255,255,255,0.12)';
  const border = danger ? c.bad : fill === 'accent' ? c.accent : 'rgba(255,255,255,0.2)';
  const fg = fill === 'accent' ? c.accentInk : c.onPitch;
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 9,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Txt style={{ fontSize: rem(0.75), fontWeight: '600', color: fg }}>{children}</Txt>
    </View>
  );
}

/** 웹 .tab-panel — 탭이 바뀔 때마다 새로 마운트돼 아래에서 8px 올라오며 들어온다(160ms, 동작 줄이기면 바로). */
function TabPanel({
  children,
  onLayout,
}: {
  children: ReactNode;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View onLayout={onLayout}>
      <Enter kind="translateY" from={8} ms={160} style={{ gap: 14 }}>
        {children}
      </Enter>
    </View>
  );
}

export default function Game() {
  const snap = useSnapshot(appState);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tab = snap.tab;
  const [playerHint, setPlayerHint] = useState(false);
  const s = snap.G as GameState | null;
  // OVR 숫자 트윈(T-10-003 goal 3): 훈련·이벤트 결과로 능력치가 바뀔 때마다 즉시 점프하는 대신 짧게 카운트업/다운한다.
  const [ovrNow] = useTween([s ? ovr(s) : 0], 420);

  // 대표 칭호를 누르면 트로피 탭의 칭호 도감으로 간다(웹 scrollIntoView 자리 — 탭 패널·도감 위치를 재 둔다).
  const panelY = useRef(0);
  const titlesY = useRef(0);
  const prepY = useRef(0);
  const wantTitles = useRef(false);
  const toTitles = () => scrollTo(Math.max(0, panelY.current + titlesY.current - insets.top - 8));
  useEffect(() => {
    if (tab !== 'trophy' || !wantTitles.current) return;
    wantTitles.current = false;
    // 새 탭 패널이 배치될 시간을 잠깐 준다.
    const id = setTimeout(toTitles, 80);
    return () => clearTimeout(id);
  }, [tab]);

  if (!s) return null;

  const L = leagueOf(s.leagueId);
  const role = roleOf(s);
  // T-10-100 연봉 옆에 몸값(이적료 기준)을 같이 둔다 — 연봉을 몸값으로 읽지 않게.
  const contract = [
    s.contract ? T.salary({ v: fmtMoney(s.contract.salary) }) : L.amateur ? T.amateur : '',
    L.amateur ? '' : T.value({ v: fmtValue(marketValue(s)) }),
  ]
    .filter(Boolean)
    .join(' · ');
  const title = mainTitle(s);
  // T-11-120 도트 선수(웹 Game.svelte와 같다). 좁은 화면에서는 2배, 아니면 3배로 그린다.
  const avatar = avatarSvg(avatarSpec(s));
  const avatarW = width < 360 ? 48 : 72;
  const focusName = T.focus({
    names: focusOf(s)
      .map((k) => labelOf(s, k))
      .join('·'),
  });

  // T-11-036 엄지 영역 고정 진행 바(웹 Game.svelte와 같다): 시즌 탭에서는 구간 진행 버튼과 그 위 한 줄 준비 요약(훈련·자기
  // 투자·컨디션)을, 다른 탭에서도 이벤트·시즌 결산이 대기 중이면 그걸 여는 버튼을 띄운다. 요약을 누르면 '다음 구간 준비' 카드로 간다.
  const act = seasonAction(s);
  const showAction = tab === 'season' || act.kind === 'pending';
  function onAct() {
    buzz();
    if (act.kind === 'pending') nextPending();
    else void advance();
  }
  const openPrep = () =>
    scrollTo(Math.max(0, panelY.current + prepY.current - insets.top - 8), prefs.motionOK);

  // T-10-117 탭을 바꾸면 이전 탭에서 내려 둔 스크롤을 물려받지 않게 맨 위로 올린다(즉시 이동).
  // T-11-025 지금 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다.
  function switchTab(k: Tab) {
    if (k === 'player')
      notePlayerVisit(playerNudge(s!, peekAvailable() && !peekOpen(s!, potPeek.peek)));
    if (appState.tab === k) return scrollTo(0, prefs.motionOK);
    appState.tab = k;
    scrollTo(0);
  }
  function openTitles() {
    if (appState.tab === 'trophy') return toTitles();
    wantTitles.current = true;
    appState.tab = 'trophy';
  }

  const tabItem = (key: Tab, label: string): TabItem => ({
    key,
    label,
    active: tab === key,
    hint: key === 'player' && playerHint ? PN.tabHint : undefined,
    onPress: () => switchTab(key),
  });
  // 게임 탭 4개 + 가운데 홈. 홈은 화면을 떠나는 버튼이다.
  const items: TabItem[] = [
    tabItem('season', T.tabSeason),
    tabItem('player', T.tabPlayer),
    { key: 'home', label: T.tabHome, active: false, onPress: goHome },
    tabItem('career', T.tabCareer),
    tabItem('trophy', T.tabTrophy),
  ];

  return (
    <BarBelow.Provider value>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Screen
          footer={
            showAction ? (
              <ActionBar>
                <PlayerNudge
                  s={s}
                  tab={tab}
                  openPlayer={() => switchTab('player')}
                  onVisibility={setPlayerHint}
                />
                {act.kind === 'advance' ? (
                  <Press
                    testID="prep"
                    accessibilityLabel={T.prepOpen({ prep: act.prep })}
                    onPress={openPrep}
                    hitSlop={{ top: 6, bottom: 2 }}
                    style={{ marginBottom: -2 }}
                  >
                    <Txt tone="muted" center numberOfLines={1} style={{ fontSize: rem(0.8125) }}>
                      {act.prep}
                    </Txt>
                  </Press>
                ) : null}
                <Btn
                  block
                  kind={act.kind === 'pending' ? 'accent' : 'primary'}
                  testID={act.kind === 'pending' ? 'resume' : 'advance'}
                  onPress={onAct}
                >
                  {`${act.label} →`}
                </Btn>
              </ActionBar>
            ) : undefined
          }
        >
          <Topbar />
          <PitchCard gap={12} style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignSelf: 'flex-end' }}>
                <SvgXml
                  xml={avatar}
                  width={avatarW}
                  height={(avatarW / 24) * 32}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Txt
                  style={{
                    fontFamily: DISPLAY[600],
                    fontSize: rem(0.9375),
                    letterSpacing: rem(0.9375) * 0.06,
                    color: c.onPitch,
                    opacity: 0.75,
                  }}
                >{`No.${s.number} · ${posLabel(s)}`}</Txt>
                {title ? (
                  <Press
                    testID="titles"
                    accessibilityLabel={T.titleOpen({ name: title.name })}
                    onPress={openTitles}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  >
                    <Txt
                      style={{ fontSize: rem(0.8125), fontWeight: '700', color: c.pitchAccent }}
                    >{`‘${title.name}’`}</Txt>
                  </Press>
                ) : null}
                <Txt
                  v="h1"
                  accessibilityRole="header"
                  style={{
                    fontSize: rem(1.5),
                    lineHeight: rem(1.5) * 1.55,
                    marginTop: 2,
                    color: c.onPitch,
                  }}
                >
                  {s.name}
                </Txt>
                <View style={{ marginTop: 4, opacity: 0.85 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Txt
                      style={{
                        fontSize: rem(0.8125),
                        lineHeight: rem(0.8125) * 1.55,
                        color: c.onPitch,
                      }}
                    >
                      {`${T.age({ n: s.age })} · `}
                    </Txt>
                    <ClubBadge club={s.club} size={16} />
                    <Txt
                      style={{
                        fontSize: rem(0.8125),
                        lineHeight: rem(0.8125) * 1.55,
                        color: c.onPitch,
                      }}
                    >
                      {` ${tn(s.club.name)}`}
                    </Txt>
                  </View>
                  <Txt
                    style={{
                      fontSize: rem(0.8125),
                      lineHeight: rem(0.8125) * 1.55,
                      color: c.onPitch,
                    }}
                  >
                    {`${tn(L.name)}${contract ? ` · ${contract}` : ''}`}
                  </Txt>
                </View>
              </View>
              <View
                accessible
                accessibilityLabel={`OVR ${Math.round(ovrNow!)}`}
                style={{ alignItems: 'flex-end' }}
              >
                <Txt
                  style={{
                    fontFamily: DISPLAY[700],
                    fontSize: rem(3.625),
                    lineHeight: rem(3.625) * 0.9,
                    color: c.accent,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {Math.round(ovrNow!)}
                </Txt>
                <Txt
                  style={{
                    fontFamily: DISPLAY[400],
                    fontSize: rem(0.75),
                    letterSpacing: rem(0.75) * 0.18,
                    color: c.onPitch,
                    opacity: 0.8,
                  }}
                >
                  OVR
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <HeroPill {...(role === '주전' ? { fill: 'accent' as const } : {})}>
                {tn(role)}
              </HeroPill>
              {s.injury ? <HeroPill danger>{T.injury({ n: s.injury })}</HeroPill> : null}
              <HeroPill>{focusName}</HeroPill>
            </View>
          </PitchCard>

          {/* 탭 전환 모션(T-10-003): 탭이 바뀔 때만 새로 마운트해 들어오는 모션을 건다. 동작 줄이기면 바로. */}
          <TabPanel key={tab} onLayout={(e) => (panelY.current = e.nativeEvent.layout.y)}>
            {tab === 'season' ? (
              <SeasonTab s={s} onPrepY={(y) => (prepY.current = y)} />
            ) : tab === 'player' ? (
              <PlayerTab s={s} />
            ) : tab === 'career' ? (
              <CareerTab s={s} />
            ) : (
              <>
                <View onLayout={(e) => (titlesY.current = e.nativeEvent.layout.y)}>
                  <TitleDex s={s} />
                </View>
                <TrophyTab s={s} />
              </>
            )}
          </TabPanel>
        </Screen>
        <TabBar label={T.menuLabel} items={items} sub="game" />
      </View>
    </BarBelow.Provider>
  );
}
