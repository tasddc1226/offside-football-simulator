// My club: shared owner identity and operations, with team-specific play in the team card.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { shapeOf, usesRankLadder } from '@offside/contracts/owner-team';
import { Alert, Platform, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchOwnerSummary } from '@offside/app-core/api/ownerSummary';
import { fetchOwnerTeam } from '@offside/app-core/api/team';
import { fetchMarketFunds, type MarketFundsResponse } from '@offside/app-core/api/market';
import { fundsText } from '@offside/app-core/market';
import {
  ownerLockedText,
  ownerTeamCard,
  ownerTeamEmptyText,
  type OwnerSummary,
  type OwnerTeamCard,
} from '@offside/app-core/ownerHub';
import { tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
import type { TeamView } from '@offside/app-core/state';
import { num, recordText } from '@offside/app-core/teamText';
import { fmtValue } from '@offside/app-core/format';
import { loadHOF } from '@offside/game/hof-store';
import { ensureAccount } from '../../game/host';
import { accountCache, appState } from '../../store';
import { isMember } from '@offside/app-core/account';
import { go } from '../../game/nav';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Card, Pill, Press, Row, Screen, Topbar, Txt, Skeleton } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { OwnerProfileEditor } from './OwnerProfileEditor';
import { LoginButtons } from './LoginButtons';
import { loadMyPlayerSummary } from '@offside/app-core/myPlayers';
import { ownerPlayersText as P } from '@offside/app-core/i18n/ko/ownerPlayers';
import { TitleBadge } from '../../components/TitleBadge';
import { OwnerAvatar } from '../../components/OwnerAvatar';
import { ownerProfileText as H } from '@offside/app-core/i18n/ko/ownerProfile';
import { Grid2, OvrBadge, Stats, type StatPress } from './TeamParts';
import { TeamLogo } from '../../components/TeamLogo';
import { GradeEmblem } from '../../ui/GradeEmblem';
import { AdSlot } from '../../components/AdSlot';
import { ManagerResume } from './ManagerResume';
import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
import { exchangeText as XC } from '@offside/app-core/i18n/ko/exchange';
import { CardExchange } from './CardExchange';
import { SeasonPass } from './SeasonPass';
import { seasonPassText as SP } from '@offside/app-core/i18n/ko/seasonPass';
import { passEntryOpen, SEASON_PASS_IOS_LIVE } from '@offside/contracts/season-pass';
import { Membership } from './Membership';
import { membershipText as MB } from '@offside/app-core/i18n/ko/membership';
import { MEMBERSHIP_IOS_LIVE, MEMBERSHIP_LIVE } from '@offside/contracts/membership';
import { teamHomeText as T } from '@offside/app-core/i18n/ko/teamHome';
import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
import { openFriends } from '../../platform/inbox';
import { myTeamTarget, ownerDotLabel } from '@offside/app-core/ownerDots';

function openTeam(v: TeamView = 'team') {
  appState.teamView = v;
  go('team');
}

/** 잠긴 내 팀 — 흐린 그라운드에 11자리(4-3-3)만 찍고 가운데에 자물쇠 표시(웹 .owner-lock). */
function LockedPitch() {
  const c = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'column-reverse',
        justifyContent: 'space-around',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: RADIUS.md,
        backgroundColor: c.pitch,
        overflow: 'hidden',
      }}
    >
      {[1, 4, 3, 3].map((n, r) => (
        <View
          key={r}
          style={{ flexDirection: 'row', justifyContent: 'space-evenly', opacity: 0.45 }}
        >
          {Array.from({ length: n }, (_, i) => (
            <View
              key={i}
              style={{
                width: 22,
                height: 22,
                borderRadius: RADIUS.sm,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: c.onPitch,
              }}
            />
          ))}
        </View>
      ))}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: RADIUS.pill,
            backgroundColor: c.surface,
          }}
        >
          <Txt style={{ fontSize: rem(FONT.label), fontWeight: '700' }}>{L.lockBadge}</Txt>
        </View>
      </View>
    </View>
  );
}

/** T-11-567 바로가기 2열 칸 하나(웹 .owner-tile): 제목 · 새 표시 · 두 줄까지의 설명. */
function Tile({
  testID,
  label,
  title,
  sub,
  fresh,
  onPress,
}: {
  testID: string;
  label: string;
  title: string;
  sub: string;
  fresh?: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      scale={0.98}
      style={{ flexBasis: '48%', flexGrow: 1 }}
    >
      <View
        style={{
          minHeight: 76,
          gap: 4,
          padding: 14,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Txt style={{ fontSize: rem(FONT.body), fontWeight: '700' }}>{title}</Txt>
          {fresh ? <Pill tone="good">{fresh}</Pill> : null}
        </View>
        <Txt tone="muted" numberOfLines={2} style={{ fontSize: rem(FONT.label) }}>
          {sub}
        </Txt>
      </View>
    </Press>
  );
}

/** 시즌 패스 · 클럽 멤버십 카드의 한 줄. */
function PerkRow({
  testID,
  label,
  title,
  sub,
  badge,
  first,
  onPress,
}: {
  testID: string;
  label: string;
  title: string;
  sub: string;
  badge?: string | null;
  first: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Press testID={testID} accessibilityLabel={label} onPress={onPress} scale={0.99}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          ...(first ? {} : { borderTopWidth: 1, borderTopColor: c.line }),
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt style={{ fontSize: rem(FONT.body), fontWeight: '700' }}>{title}</Txt>
            {badge ? <Pill tone="good">{badge}</Pill> : null}
          </View>
          <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
            {sub}
          </Txt>
        </View>
        <Txt tone="muted" style={{ fontSize: rem(FONT.title2) }}>
          ›
        </Txt>
      </View>
    </Press>
  );
}

export default function Owner() {
  const cache = useSnapshot(accountCache);
  // T-11-567 계정 카드가 설정으로 옮겨 가서, 로그인 여부는 이 화면이 직접 확인한다(5분 메모).
  useEffect(ensureAccount, []);
  // 받은 친구 신청(T-11-142)이나 아직 안 본 새 업적이 있으면 '내 팀' 버튼에 빨간 점, 누르면 바로 친구 · 업적 탭으로.
  const { achNew, friendReq } = useSnapshot(appState);
  const teamDot = ownerDotLabel({ friendReq, achNew });
  const teamBtn = {
    dot: !!teamDot,
    onPress: () => {
      const to = myTeamTarget({ friendReq, achNew });
      if (to === 'friends') openFriends();
      else openTeam(to);
    },
    ...(teamDot ? { accessibilityLabel: `${L.myTeam}, ${teamDot}` } : {}),
  };
  const acct = cache.value;
  // T-10-016: 운영자면 프로필 편집에 운영 도구 표시를 넘긴다(운영 도구 입구는 T-11-567부터 설정 화면의 계정 카드).
  // 관리자는 구글 연결 계정이라, 연결된 계정일 때만 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다).
  const [admin, setAdmin] = useState(false);
  // T-11-374 카드 과제 창.
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const linked = !!acct && acct !== 'error' && isMember(acct);
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const [localCount] = useState(() => loadHOF().length);
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  const nickname = acct && acct !== 'error' ? acct.nickname : null;

  // 비로그인 구단 가치는 이 기기 기록의 카드 기준가 합(T-11-567 명예관 미리보기를 빼서 로그인하면 묻지 않는다).
  const { tick, track } = useRefresh();
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  useEffect(() => {
    if (!guest) return;
    let alive = true;
    void track(loadMyPlayerSummary(false)).then((value) => {
      if (alive) setSummary(value);
    });
    return () => {
      alive = false;
    };
  }, [guest, tick, track]);
  // 내 팀 카드 — 팀 화면과 같은 응답(1분 메모)이라 팀 화면에 들어가도 다시 묻지 않는다.
  const [card, setCard] = useState<OwnerTeamCard | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  // T-11-080 구단 자금 · 구단 가치(자금 + 가진 카드의 기준가, T-11-109)는 서버가 센다. 이적시장 화면과 같은 응답(1분
  // 메모)이라 이적시장에 들어가도 다시 묻지 않는다. 비로그인이면 이 기기 기록의 카드 기준가 합을 쓴다.
  const [market, setMarket] = useState<MarketFundsResponse | null>(null);

  const [tierTag, setTierTag] = useState<OwnerTierTag | null>(null);
  useEffect(() => {
    let alive = true;
    if (!linked) {
      setAdmin(false);
      setTierTag(null);
      return;
    }
    void track(fetchOwnerSummary()).then((r) => {
      if (alive && r.ok) {
        setAdmin(r.data.admin);
        setTierTag(r.data.tier);
      }
    });
    return () => {
      alive = false;
    };
  }, [linked, tick, track]);
  useEffect(() => {
    if (!linked) return;
    let alive = true;
    void track(fetchOwnerTeam()).then((r) => {
      if (!alive) return;
      if (r.ok) setCard(ownerTeamCard(r.data));
      else setCardFailed(true);
    });
    void track(fetchMarketFunds()).then((r) => alive && r.ok && setMarket(r.data));
    return () => {
      alive = false;
    };
  }, [linked, tick, track]);
  const clubValue = linked ? (market?.clubValue ?? null) : (summary?.value ?? null);
  const funds = market ? fundsText(market.balance) : '–';

  const team = card?.team;
  const sub = guest ? L.guestSub : L.title;
  const passEntry =
    (passEntryOpen(new Date().toISOString()) && (Platform.OS !== 'ios' || SEASON_PASS_IOS_LIVE)) ||
    __DEV__;
  const memberEntry =
    (MEMBERSHIP_LIVE && (Platform.OS !== 'ios' || MEMBERSHIP_IOS_LIVE)) || __DEV__;
  const playersTile = !guest || localCount > 0;

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {L.hubTitle}
        </Txt>
      </View>

      {linked || guest ? (
        // T-11-567 구단 가치 · 자금은 따로 카드를 두지 않고 프로필 카드 아래 줄에 둔다.
        <Card gap={14} testID="owner-summary">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <OwnerAvatar
              avatarId={acct?.avatarId ?? null}
              name={nickname ?? L.avatarInitial}
              size={48}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Row gap={6}>
                {tierTag ? (
                  // 이름 앞 지난 시즌 등급 엠블럼(웹 .owner-last-tier).
                  <View
                    testID={`owner-last-tier-${tierTag.tier}`}
                    accessible
                    accessibilityLabel={tierTitle(tierTag)}
                    style={{ marginRight: -2 }}
                  >
                    <GradeEmblem id={tierTag.tier} size={24} />
                  </View>
                ) : null}
                <Txt style={{ fontSize: rem(FONT.title3), fontWeight: '700' }}>
                  {guest ? L.guestName : (nickname ?? L.title)}
                </Txt>
                {card?.title ? <TitleBadge title={card.title} /> : null}
                {card?.member ? (
                  <View testID="owner-member-badge" accessible accessibilityLabel={MB.badgeLabel}>
                    <Pill tone="good">{MB.badge}</Pill>
                  </View>
                ) : null}
              </Row>
              <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                {sub}
              </Txt>
            </View>
            {linked && acct ? <OwnerProfileEditor profile={acct} admin={admin} /> : null}
          </View>
          <View testID="club-operations" accessibilityLabel={L.operationsHeading}>
            <Stats
              accent
              items={[
                [
                  L.statClubValue,
                  clubValue !== null ? fmtValue(clubValue) : '–',
                  {
                    info: true,
                    label: L.valueInfoTitle,
                    testID: 'club-value-info',
                    onPress: () =>
                      Alert.alert(
                        L.valueInfoTitle,
                        [
                          linked ? L.valueInfoFormula : L.valueInfoGuest,
                          ...(linked ? [L.valueInfoOwned] : []),
                          L.valueInfoPrice,
                          L.valueInfoFallback,
                          L.valueInfoExcluded,
                        ].join('\n\n'),
                        [{ text: T.close }],
                      ),
                  },
                ],
                ...(linked
                  ? [
                      [
                        L.statFunds,
                        funds,
                        {
                          onPress: () => go('funds'),
                          label: F.openAria,
                          testID: 'funds-history',
                        },
                      ] as [string, string, StatPress],
                    ]
                  : []),
              ]}
            />
          </View>
        </Card>
      ) : null}

      {linked || guest ? <AdSlot place="owner-summary" /> : null}

      {/* T-11-338 진행 중인 감독 커리어가 있으면 맨 위에서 이어 한다. */}
      {linked ? <ManagerResume /> : null}
      {linked || guest ? (
        <Txt v="h2" accessibilityRole="header">
          {L.teamsHeading}
        </Txt>
      ) : null}
      {/* T-10-092 내 팀: 로그인한 구단주만 — 확인 중·연결 실패면 그리지 않는다. 비로그인이면 잠긴 카드. */}
      {linked ? (
        <Card gap={12} testID="owner-team">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            {team ? <TeamLogo logo={team.logo} name={team.name} size={44} decorative /> : null}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt v="eyebrow">{`${L.myTeam}${card?.season ? ` · ${card.season}` : ''}`}</Txt>
              <Txt v="h2" accessibilityRole="header">
                {team?.name ?? L.myTeam}
              </Txt>
              {team ? (
                <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                  {L.manager({
                    manager: team.manager,
                    formation: shapeOf(team.formation, team.layout),
                  })}
                </Txt>
              ) : null}
            </View>
            {team ? <OvrBadge ovr={team.ovr} /> : null}
          </View>
          {team && card ? (
            <>
              <Stats
                small
                first={1.35}
                items={[
                  [L.statRecord, recordText(team.record)],
                  [usesRankLadder(team.season) ? L.statRp : L.statRating, num(team.rating)],
                  [L.statToday, `${card.left}/${card.perDay}`],
                ]}
              />
              <Grid2>
                <Btn block testID="team" {...teamBtn}>
                  {L.manageTeam}
                </Btn>
                <Btn
                  kind="accent"
                  block
                  testID="owner-play"
                  disabled={!!card.playHint}
                  onPress={() => openTeam('opponents')}
                >
                  {L.play}
                </Btn>
              </Grid2>
              {card.playHint ? (
                <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                  {card.playHint}
                </Txt>
              ) : null}
            </>
          ) : (
            <>
              {card || cardFailed ? (
                <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                  {card ? ownerTeamEmptyText(card) : L.teamFailed}
                </Txt>
              ) : (
                <Skeleton rows={2} />
              )}
              <Btn
                kind={card && card.players > 0 ? 'primary' : 'default'}
                block
                testID="team"
                {...teamBtn}
              >
                {card && card.players > 0 ? L.buildTeam : L.teamBtnApp}
              </Btn>
            </>
          )}
        </Card>
      ) : guest ? (
        <Card gap={12} testID="owner-team-locked">
          <View style={{ gap: 2 }}>
            <Txt v="h2" accessibilityRole="header">
              {L.myTeam}
            </Txt>
          </View>
          <LockedPitch />
          <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
            {ownerLockedText(localCount)}
          </Txt>
          {/* 로그아웃·탈퇴 직후엔 세션이 없으므로 startGoogleLogin이 새 익명 세션부터 받는다. */}
          <LoginButtons />
        </Card>
      ) : null}

      {/* T-11-567 바로가기: 한 줄 카드 여섯 장을 2열 칸으로 줄였다. 상점 넷은 상점 화면으로 옮겼다. */}
      {linked || playersTile ? (
        <View
          testID="owner-tiles"
          accessibilityLabel={L.shortcutsHeading}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {playersTile ? (
            <Tile
              testID="open-owner-players"
              label={P.openPlayers}
              title={P.title}
              sub={L.tilePlayers}
              onPress={() => {
                appState.playersView = linked ? 'manage' : 'records';
                go('players');
              }}
            />
          ) : null}
          {linked ? (
            <>
              <Tile
                testID="market"
                label={`${L.marketTitle} ${L.open}`}
                title={L.marketTitle}
                sub={L.tileMarket}
                onPress={() => go('market')}
              />
              <Tile
                testID="exchange"
                label={XC.entryAria}
                title={XC.entryTitle}
                sub={L.tileExchange}
                fresh={XC.entryNew}
                onPress={() => setExchangeOpen(true)}
              />
              <Tile
                testID="manager"
                label={MG.entryAria}
                title={MG.entryTitle}
                sub={L.tileManager}
                fresh={MG.entryNew}
                onPress={() => go('manager')}
              />
              <Tile
                testID="open-owner-hall"
                label={`${H.openHall} · ${H.hallNew}`}
                title={H.hallTitle}
                sub={L.tileHall}
                fresh={H.hallNew}
                onPress={() => go('honors')}
              />
              <Tile
                testID="shop"
                label={L.shopTitle}
                title={L.shopTitle}
                sub={L.tileShop}
                onPress={() => go('shop')}
              />
            </>
          ) : null}
        </View>
      ) : null}
      {exchangeOpen ? <CardExchange onClose={() => setExchangeOpen(false)} /> : null}

      {linked && (passEntry || memberEntry) ? (
        // T-11-567 시즌 패스 · 클럽 멤버십은 한 카드에 두 줄로.
        <Card gap={0} testID="owner-perks" style={{ paddingVertical: 4 }}>
          {passEntry ? (
            <PerkRow
              testID="season-pass"
              label={SP.entry}
              title={SP.entry}
              sub={SP.entryNew}
              first
              onPress={() => setPassOpen(true)}
            />
          ) : null}
          {memberEntry ? (
            <PerkRow
              testID="membership"
              label={MB.entry}
              title={MB.entry}
              sub={MB.entrySub}
              badge={card?.member ? MB.entryActive : null}
              first={!passEntry}
              onPress={() => setMemberOpen(true)}
            />
          ) : null}
        </Card>
      ) : null}
      {passOpen ? <SeasonPass onClose={() => setPassOpen(false)} /> : null}
      {memberOpen ? <Membership onClose={() => setMemberOpen(false)} /> : null}
    </Screen>
  );
}
