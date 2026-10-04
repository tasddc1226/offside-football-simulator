// 구단주 화면(웹 Owner.svelte, T-10-058) — 게임 속 사용자 프로필. 계정(로그인·닉네임) 카드, 내 팀 입구, 내 선수,
// 운영 도구(관리자) 입구.
// T-10-102 비로그인이면 계정 카드는 안내만, 로그인 버튼은 카드 밖에 하나만 두고 로그인해야 쓰는 '내 팀'은 숨긴다.
// 구단 이름·엠블럼 변경은 환경설정에 있다.
// T-11-026 구단 허브 — 맨 위에 구단주 요약(은퇴 선수·레전드 점수·결번), 그 아래 '내 팀' 카드(전적·레이팅·오늘 남은
// 경기와 바로 경기하기), 내 선수 상위 3명, 계정은 맨 아래. 비로그인이면 '내 팀' 자리에 잠긴 카드와 로그인 버튼을 둔다.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchBoardViewer } from '@offside/app-core/api/boards';
import { fetchOwnerTeam } from '@offside/app-core/api/team';
import { fetchMarketMe, type MarketMeResponse } from '@offside/app-core/api/market';
import { fundsText } from '@offside/app-core/market';
import {
  ownerLockedText,
  ownerSummary,
  ownerTeamCard,
  ownerTeamEmptyText,
  type OwnerSummary,
  type OwnerTeamCard,
} from '@offside/app-core/ownerHub';
import type { TeamView } from '@offside/app-core/state';
import { num, recordText } from '@offside/app-core/teamText';
import { fmtValue } from '@offside/app-core/format';
import { loadHOF } from '@offside/game/season';
import { accountCache, appState } from '../../store';
import { isMember } from '@offside/app-core/account';
import { go } from '../../game/nav';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Screen, Topbar, Txt } from '../../ui';
import { Account } from './Account';
import { LoginButtons } from './LoginButtons';
import { MyPlayers } from './MyPlayers';
import { Grid2, OvrBadge, Stats } from './TeamParts';
import { TeamLogo } from '../../components/TeamLogo';
import { SettingsCard, SettingsLabel, SettingsTrigger } from '../settings/parts';

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
          <Txt style={{ fontSize: rem(0.8125), fontWeight: '700' }}>🔒︎ 로그인하면 열려요</Txt>
        </View>
      </View>
    </View>
  );
}

export default function Owner() {
  const c = useColors();
  const cache = useSnapshot(accountCache);
  const acct = cache.value;
  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  const [admin, setAdmin] = useState(false);
  const linked = !!acct && acct !== 'error' && isMember(acct);
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const [localCount] = useState(() => loadHOF().length);
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  const nickname = acct && acct !== 'error' ? acct.nickname : null;

  // 요약은 '내 선수'가 불러온 목록으로 센다(비로그인이면 이 기기 기록).
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const onRows = useCallback(
    (rows: Parameters<typeof ownerSummary>[0]) => setSummary(ownerSummary(rows)),
    [],
  );
  // 내 팀 카드 — 팀 화면과 같은 응답(1분 메모)이라 팀 화면에 들어가도 다시 묻지 않는다.
  const [card, setCard] = useState<OwnerTeamCard | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  // T-11-080 구단 자금 · 구단 가치(자금 + 직접 키운 선수 은퇴 가치 + 영입한 선수 기준가)는 서버가 센다. 이적시장 화면과
  // 같은 응답(1분 메모)이라 이적시장에 들어가도 다시 묻지 않는다. 비로그인이면 이 기기 기록의 은퇴 가치 합을 쓴다.
  const [market, setMarket] = useState<MarketMeResponse | null>(null);

  useEffect(() => {
    if (!linked) {
      setAdmin(false);
      return;
    }
    let alive = true;
    void fetchBoardViewer().then((r) => alive && setAdmin(r.ok && r.data.admin));
    void fetchOwnerTeam().then((r) => {
      if (!alive) return;
      if (r.ok) setCard(ownerTeamCard(r.data));
      else setCardFailed(true);
    });
    void fetchMarketMe().then((r) => alive && r.ok && setMarket(r.data));
    return () => {
      alive = false;
    };
  }, [linked]);
  const clubValue = market?.clubValue ?? summary?.value ?? null;

  const team = card?.team;
  const sub = guest
    ? '기록은 이 기기에만 저장돼요'
    : team
      ? `${team.name} · ${card.season}`
      : '로그인했어요';

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Owner</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          구단주
        </Txt>
      </View>

      {linked || guest ? (
        <Card gap={14} testID="owner-summary">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: c.pitch,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.375), color: c.pitchAccent }}>
                {(nickname ?? '구').slice(0, 1)}
              </Txt>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt style={{ fontSize: rem(1.125), fontWeight: '700' }}>
                {guest ? '게스트 구단주' : (nickname ?? '구단주')}
              </Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                {sub}
              </Txt>
            </View>
          </View>
          {(guest && localCount === 0) || (summary?.players === 0 && !market?.clubValue) ? (
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              첫 커리어를 끝까지 뛰면 은퇴 선수와 레전드 점수가 여기에 쌓여요.
            </Txt>
          ) : (
            <View style={{ gap: 8 }}>
              <Stats
                accent
                items={[['구단 가치', clubValue !== null ? fmtValue(clubValue) : '–']]}
              />
              <Stats
                items={[
                  ['은퇴 선수', summary ? `${num(summary.players)}명` : '–'],
                  ['레전드 점수', summary ? num(summary.score) : '–'],
                  ['영구결번', summary ? `${summary.retired}개` : '–'],
                ]}
              />
            </View>
          )}
        </Card>
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
                <Txt v="eyebrow">{`My team${card?.season ? ` · ${card.season}` : ''}`}</Txt>
                <Txt v="h2" accessibilityRole="header">
                  {team?.name ?? '내 팀'}
                </Txt>
                {team ? (
                  <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                    {`${team.manager} 감독 · ${team.formation}`}
                  </Txt>
                ) : null}
              </View>
              {team ? <OvrBadge ovr={team.ovr} /> : null}
            </View>
            {team && card ? (
              <>
                <Stats
                  small
                  items={[
                    ['전적', recordText(team.record)],
                    ['레이팅', num(team.rating)],
                    ['오늘 경기', `${card.left}/${card.perDay}`],
                  ]}
                />
                <Grid2>
                  <Btn block testID="team" onPress={() => openTeam()}>
                    내 팀
                  </Btn>
                  <Btn
                    kind="accent"
                    block
                    testID="owner-play"
                    disabled={!!card.playHint}
                    onPress={() => openTeam('opponents')}
                  >
                    경기하기
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
                  {card
                    ? ownerTeamEmptyText(card)
                    : cardFailed
                      ? '시즌마다 은퇴한 선수로 팀을 꾸려 겨루고, 라이브 랭킹과 구단 업적을 채워요.'
                      : '불러오는 중…'}
                </Txt>
                <Btn
                  kind={card && card.players > 0 ? 'primary' : 'default'}
                  block
                  testID="team"
                  onPress={() => openTeam()}
                >
                  {card && card.players > 0 ? '팀 만들기' : '내 팀 · 시즌 업적'}
                </Btn>
              </>
            )}
          </Card>
          <Card gap={12} testID="owner-market">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt v="eyebrow">Transfer market</Txt>
                <Txt v="h2" accessibilityRole="header">
                  이적시장
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                  {`구단 자금 ${market ? fundsText(market.balance) : '–'} · 이번 시즌 선수를 사고팔아요`}
                </Txt>
              </View>
              <Btn testID="market" onPress={() => go('market')}>
                열기
              </Btn>
            </View>
          </Card>
        </>
      ) : guest ? (
        <Card gap={12} testID="owner-team-locked">
          <View style={{ gap: 2 }}>
            <Txt v="eyebrow">My team</Txt>
            <Txt v="h2" accessibilityRole="header">
              내 팀
            </Txt>
          </View>
          <LockedPitch />
          <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
            {ownerLockedText(localCount)}
          </Txt>
          {/* 로그아웃·탈퇴 직후엔 세션이 없으므로 startGoogleLogin이 새 익명 세션부터 받는다. */}
          <LoginButtons />
        </Card>
      ) : null}

      {!guest || localCount > 0 ? <MyPlayers onRows={onRows} /> : null}

      <SettingsCard>
        <Account admin={admin} />
        {admin ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 4,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <SettingsTrigger testID="admin" label="운영 도구" onPress={() => go('admin')}>
              <SettingsLabel title="운영 도구" />
            </SettingsTrigger>
          </View>
        ) : null}
      </SettingsCard>
    </Screen>
  );
}
