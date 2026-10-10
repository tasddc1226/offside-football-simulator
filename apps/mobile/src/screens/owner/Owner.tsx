// My club: shared owner identity and operations, with team-specific play in the team card.
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
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
import { accountCache, appState } from '../../store';
import { isMember } from '@offside/app-core/account';
import { go, takeFocus } from '../../game/nav';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Card, Pill, Press, Row, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { Account } from './Account';
import { OwnerProfileEditor } from './OwnerProfileEditor';
import { LoginButtons } from './LoginButtons';
import { loadMyPlayerSummary } from '@offside/app-core/myPlayers';
import { ownerPlayersText as P } from '@offside/app-core/i18n/ko/ownerPlayers';
import { TitleBadge } from '../../components/TitleBadge';
import { OwnerAvatar } from '../../components/OwnerAvatar';
import { ownerProfileText as H } from '@offside/app-core/i18n/ko/ownerProfile';
import { BoostShop } from './BoostShop';
import { ScoutShop } from './ScoutShop';
import { RerollShop } from './RerollShop';
import { GRADE_COLOR, Grid2, OvrBadge, Stats, type StatPress } from './TeamParts';
import { mix } from '../../theme/colors';
import { TeamLogo } from '../../components/TeamLogo';
import { GradeEmblem } from '../../ui/GradeEmblem';
import { AdSlot } from '../../components/AdSlot';
import { SettingsCard, SettingsLabel, SettingsTrigger } from '../settings/parts';
import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
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
        borderRadius: 14,
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
                borderRadius: 11,
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
            borderRadius: 999,
            backgroundColor: c.surface,
          }}
        >
          <Txt style={{ fontSize: rem(0.8125), fontWeight: '700' }}>{L.lockBadge}</Txt>
        </View>
      </View>
    </View>
  );
}

export default function Owner() {
  const c = useColors();
  const cache = useSnapshot(accountCache);
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
  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  // T-11-152 후보 화면 '리롤권 상점 가기'로 들어왔으면 리롤권 상점을 펼친 채로 연다(한 번만 읽힌다).
  const [shopFocus] = useState(() => takeFocus('rerollShop'));
  const [admin, setAdmin] = useState(false);
  const linked = !!acct && acct !== 'error' && isMember(acct);
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const [localCount] = useState(() => loadHOF().length);
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  const nickname = acct && acct !== 'error' ? acct.nickname : null;

  // 전용 목록을 열지 않아도 현재 시즌의 기존 기록 기준으로 요약한다.
  const { tick, track } = useRefresh();
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  useEffect(() => {
    if (!linked && !guest) return;
    let alive = true;
    void track(loadMyPlayerSummary(linked)).then((value) => {
      if (alive) setSummary(value);
    });
    return () => {
      alive = false;
    };
  }, [linked, guest, tick, track]);
  // 내 팀 카드 — 팀 화면과 같은 응답(1분 메모)이라 팀 화면에 들어가도 다시 묻지 않는다.
  const [card, setCard] = useState<OwnerTeamCard | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  // T-11-080 구단 자금 · 구단 가치(자금 + 가진 카드의 기준가, T-11-109)는 서버가 센다. 이적시장 화면과 같은 응답(1분
  // 메모)이라 이적시장에 들어가도 다시 묻지 않는다. 비로그인이면 이 기기 기록의 카드 기준가 합을 쓴다.
  const [market, setMarket] = useState<MarketFundsResponse | null>(null);

  const [tierTag, setTierTag] = useState<OwnerTierTag | null>(null);
  const [tiers, setTiers] = useState<OwnerTierTag[]>([]);
  useEffect(() => {
    let alive = true;
    if (!linked) {
      setAdmin(false);
      setTierTag(null);
      setTiers([]);
      return;
    }
    void track(fetchOwnerSummary()).then((r) => {
      if (alive && r.ok) {
        setAdmin(r.data.admin);
        setTierTag(r.data.tier);
        setTiers(r.data.tiers ?? (r.data.tier ? [r.data.tier] : []));
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

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {L.hubTitle}
        </Txt>
      </View>

      {linked || guest ? (
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
                <Txt style={{ fontSize: rem(1.125), fontWeight: '700' }}>
                  {guest ? L.guestName : (nickname ?? L.title)}
                </Txt>
                {card?.title ? <TitleBadge title={card.title} /> : null}
              </Row>
              <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                {sub}
              </Txt>
            </View>
            {linked && acct ? <OwnerProfileEditor profile={acct} admin={admin} /> : null}
          </View>
        </Card>
      ) : null}

      {linked || guest ? <AdSlot place="owner-summary" /> : null}

      {linked || guest ? (
        <Txt v="h2" accessibilityRole="header">
          {L.teamsHeading}
        </Txt>
      ) : null}
      {/* T-10-092 내 팀: 로그인한 구단주만 — 확인 중·연결 실패면 그리지 않는다. 비로그인이면 잠긴 카드. */}
      {linked ? (
        <>
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
                  <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                    {L.manager({ manager: team.manager, formation: team.formation })}
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
                    [L.statRating, num(team.rating)],
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
                  <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                    {card.playHint}
                  </Txt>
                ) : null}
              </>
            ) : (
              <>
                <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                  {card ? ownerTeamEmptyText(card) : cardFailed ? L.teamFailed : L.loading}
                </Txt>
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
        </>
      ) : guest ? (
        <>
          <Card gap={12} testID="owner-team-locked">
            <View style={{ gap: 2 }}>
              <Txt v="h2" accessibilityRole="header">
                {L.myTeam}
              </Txt>
            </View>
            <LockedPitch />
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              {ownerLockedText(localCount)}
            </Txt>
            {/* 로그아웃·탈퇴 직후엔 세션이 없으므로 startGoogleLogin이 새 익명 세션부터 받는다. */}
            <LoginButtons />
          </Card>
        </>
      ) : null}

      {!guest || localCount > 0 ? (
        <Press
          testID="open-owner-players"
          accessibilityLabel={P.openPlayers}
          onPress={() => {
            appState.playersView = linked ? 'manage' : 'records';
            go('players');
          }}
          scale={0.98}
        >
          <Card gap={12} testID="owner-players-entry">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt v="h2">{P.title}</Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                  {P.entryLead}
                </Txt>
              </View>
              <Txt tone="muted" style={{ fontSize: rem(1.5) }}>
                ›
              </Txt>
            </View>
          </Card>
        </Press>
      ) : null}

      {linked || guest ? (
        <Card gap={12} testID="club-operations">
          <Txt v="h2" accessibilityRole="header">
            {L.operationsHeading}
          </Txt>
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
        </Card>
      ) : null}

      {linked ? (
        <>
          <Press
            testID="market"
            accessibilityLabel={`${L.marketTitle} ${L.open}`}
            onPress={() => go('market')}
            scale={0.98}
          >
            <Card gap={12} testID="owner-market">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt v="h2">{L.marketTitle}</Txt>
                  <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                    {L.marketSub({ funds })}
                  </Txt>
                </View>
                <Txt tone="muted" style={{ fontSize: rem(1.5) }}>
                  ›
                </Txt>
              </View>
            </Card>
          </Press>
        </>
      ) : null}

      {linked ? (
        <>
          <RerollShop
            focus={shopFocus}
            onBought={(balance, spent) =>
              setMarket((m) => m && { balance, clubValue: m.clubValue - spent })
            }
          />
          <BoostShop />
          <ScoutShop />
        </>
      ) : null}

      {linked ? (
        <Press
          testID="open-owner-hall"
          accessibilityLabel={`${H.openHall} · ${H.hallNew}`}
          onPress={() => go('honors')}
          scale={0.98}
        >
          <Card gap={12} testID="owner-hall-entry">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                >
                  <Txt v="h2">{H.hallTitle}</Txt>
                  <View testID="owner-hall-new">
                    <Pill tone="good">{H.hallNew}</Pill>
                  </View>
                </View>
                <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                  {H.hallSummary}
                </Txt>
              </View>
              <Txt tone="muted" style={{ fontSize: rem(1.5) }}>
                ›
              </Txt>
            </View>
            {tiers.length ? (
              <View
                accessibilityLabel={L.seasonTierHistory}
                testID="owner-tier-history"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
              >
                {tiers.map((tier) => (
                  <View
                    key={tier.season}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: c.line,
                      borderRadius: 6,
                      backgroundColor: c.surface2,
                    }}
                  >
                    <GradeEmblem id={tier.tier} size={16} />
                    <Txt
                      style={{
                        fontSize: rem(0.75),
                        fontWeight: '600',
                        color: mix(GRADE_COLOR[tier.tier] ?? GRADE_COLOR.rookie!, c.ink, 0.65),
                      }}
                    >
                      {tierTitle(tier)}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : null}
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              {card?.season ?? L.currentSeason}
            </Txt>
            <Stats
              items={[
                [L.statRetired, summary ? num(summary.players) : '–'],
                [L.statLegend, summary ? num(summary.score) : '–'],
                [L.statRetiredNumbers, summary ? num(summary.retired) : '–'],
              ]}
            />
          </Card>
        </Press>
      ) : null}

      <SettingsCard>
        <Account />
        {admin ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 4,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <SettingsTrigger testID="admin" label={L.adminTools} onPress={() => go('admin')}>
              <SettingsLabel title={L.adminTools} />
            </SettingsTrigger>
          </View>
        ) : null}
      </SettingsCard>
    </Screen>
  );
}
