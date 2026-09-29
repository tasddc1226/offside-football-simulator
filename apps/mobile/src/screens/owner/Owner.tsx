// 구단주 화면(웹 Owner.svelte, T-10-058) — 게임 속 사용자 프로필. 계정(로그인·닉네임) 카드, 내 팀 입구, 내 선수,
// 운영 도구(관리자) 입구.
// T-10-102 비로그인이면 계정 카드는 안내만, 로그인 버튼은 카드 밖에 하나만 두고 로그인해야 쓰는 '내 팀'은 숨긴다.
// 구단 이름·엠블럼 변경은 환경설정에 있다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchBoardViewer } from '@offside/app-core/api/boards';
import { loadHOF } from '@offside/game/season';
import { accountCache, appState } from '../../store';
import { go } from '../../game/nav';
import { Screen, Topbar, Txt } from '../../ui';
import { Account } from './Account';
import { LoginButtons } from './LoginButtons';
import { MyPlayers } from './MyPlayers';
import { SettingsCard, SettingsLabel, SettingsTrigger } from '../settings/parts';

export default function Owner() {
  const cache = useSnapshot(accountCache);
  const acct = cache.value;
  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  const [admin, setAdmin] = useState(false);
  const linked = !!acct && acct !== 'error' && acct.linked.google;
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const [hasLocal] = useState(() => loadHOF().length > 0);
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = acct === null || (!!acct && acct !== 'error' && !acct.linked.google);

  useEffect(() => {
    if (!linked) {
      setAdmin(false);
      return;
    }
    let alive = true;
    void fetchBoardViewer().then((r) => alive && setAdmin(r.ok && r.data.admin));
    return () => {
      alive = false;
    };
  }, [linked]);

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Owner</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          구단주
        </Txt>
      </View>

      <SettingsCard>
        <Account admin={admin} />
      </SettingsCard>

      {/* 로그아웃·탈퇴 직후엔 세션이 없으므로 startGoogleLogin이 새 익명 세션부터 받는다. */}
      {guest ? <LoginButtons /> : null}

      {/* T-10-092 내 팀: 구글로 로그인한 구단주만 — 확인 중·비로그인·연결 실패면 그리지 않는다. */}
      {linked ? (
        <SettingsCard>
          <SettingsTrigger
            testID="team"
            label="내 팀 · 시즌 업적"
            onPress={() => {
              appState.teamView = 'team';
              go('team');
            }}
          >
            <SettingsLabel
              eyebrow="My team"
              title="내 팀 · 시즌 업적"
              muted="시즌마다 은퇴한 선수로 팀을 꾸려 겨루고, 라이브 랭킹과 구단 업적을 채워요"
            />
          </SettingsTrigger>
        </SettingsCard>
      ) : null}

      {!guest || hasLocal ? <MyPlayers /> : null}

      {admin ? (
        <SettingsCard>
          <SettingsTrigger testID="admin" label="운영 도구" onPress={() => go('admin')}>
            <SettingsLabel eyebrow="Admin" title="운영 도구" />
          </SettingsTrigger>
        </SettingsCard>
      ) : null}
    </Screen>
  );
}
