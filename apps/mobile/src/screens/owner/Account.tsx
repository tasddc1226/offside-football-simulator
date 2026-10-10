// ───────── 계정 영역: 로그인 상태 · 프로필 · 연동 해제 · 로그아웃 · 탈퇴 (웹 Account.svelte) ─────────
// 게임 데이터는 전부 기기에 남고, 여기서 다루는 건 로그인 상태뿐이다. 오프라인/서버 오류에도 게임 자체는 그대로
// 플레이할 수 있어야 하므로, 실패 시 조용히 '연결할 수 없어요'로 두고 게임 화면을 막지 않는다.
// 앱은 세션 쿠키 대신 기기 보안 저장소의 세션 토큰을 쓴다 — 로그아웃·탈퇴 뒤에는 토큰도 지운다.
import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  confirmProfileDeletion,
  logout,
  startProfileDeletion,
  unlinkGoogle,
} from '@offside/app-core/api/client';
import { accountCache, appState } from '../../store';
import { noteOwner } from '@offside/app-core/api/friendPending';
import { accountLabel, isMember } from '@offside/app-core/account';
import { closeSheet, refreshAccount, showSheet } from '../../game/host';
import { appleReauthCode } from '../../platform/auth';
import { setSessionToken } from '../../platform/session';
import { rem } from '../../theme/type';
import { NicknameForm } from '../../components/NicknameForm';
import { Btn, Row, Txt } from '../../ui';
import { LinkBtn } from '../settings/parts';
import { accountText as L } from '@offside/app-core/i18n/ko/account';

// 화면을 벗어났다 돌아와도(다시 마운트) 캐시가 이 시간 안이면 '확인 중…'을 다시 보이지 않는다.
const REVALIDATE_MS = 5 * 60_000;

const set = (v: typeof accountCache.value) => {
  accountCache.value = v;
};

async function load(silent = false) {
  if (!silent) set(undefined);
  await refreshAccount();
}

async function doUnlink() {
  const r = await unlinkGoogle();
  if (r.ok) await load();
  else set('error');
}
async function doLogout() {
  closeSheet();
  await logout();
  await setSessionToken(null);
  noteOwner(false);
  appState.friendReq = 0;
  set(null);
}
function askLogout() {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Account',
      title: L.logoutTitle,
      muted: true,
      text: L.logoutBodyApp,
    },
    [
      { label: L.logout, cls: 'btn-primary', fn: () => void doLogout() },
      { label: L.cancel, fn: closeSheet },
    ],
  );
}
/** 계정 삭제(스토어 심사 필수): 확인 → (Apple 연결이면 Apple 재확인) → 삭제 시작(확인 토큰) → 삭제 확정.
 *  끝나면 세션 토큰도 지운다. Apple 재확인을 취소하면 지우지 않는다. */
async function doDeleteFlow() {
  const linked = accountCache.value;
  const code = linked && linked !== 'error' && linked.linked.apple ? await appleReauthCode() : null;
  if (code === 'cancel') return;
  const start = await startProfileDeletion();
  if (!start.ok) return set('error');
  const done = await confirmProfileDeletion(start.data.confirmToken, code ?? undefined);
  if (done.ok) await setSessionToken(null);
  set(done.ok ? null : 'error');
}
function askDelete() {
  Alert.alert(L.deleteAccount, L.deleteBody, [
    { text: L.cancel, style: 'cancel' },
    { text: L.deleteConfirm, style: 'destructive', onPress: () => void doDeleteFlow() },
  ]);
}

/** 관리자 계정(구단주 화면이 확인한다)은 댓글 닉네임이 '운영자'로 고정돼 바꾸는 칸이 없다. */
export function Account({ admin = false }: { admin?: boolean }) {
  const cache = useSnapshot(accountCache);
  const profile = cache.value;

  useEffect(() => {
    if (accountCache.value === undefined) void load();
    else if (Date.now() - accountCache.fetchedAt > REVALIDATE_MS) void load(true);
  }, []);

  const who = { flex: 1, minWidth: 0, gap: 3 } as const;
  const head = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as const;
  const bTitle = { fontSize: rem(1), fontWeight: '700' } as const;
  const bMuted = { fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5 } as const;

  if (profile === undefined)
    return (
      <View style={head} accessibilityLiveRegion="polite">
        <View style={who}>
          <Txt style={bTitle}>{L.title}</Txt>
          <Txt tone="muted" style={bMuted}>
            {L.checking}
          </Txt>
        </View>
      </View>
    );
  if (profile === 'error')
    return (
      <View style={head}>
        <View style={who}>
          <Txt style={bTitle}>{L.errorTitle}</Txt>
          <Txt tone="muted" style={bMuted}>
            {L.errorBody}
          </Txt>
        </View>
        <Btn sm onPress={() => void load()} testID="account-retry">
          {L.retry}
        </Btn>
      </View>
    );
  if (!profile || !isMember(profile))
    // T-10-102 비로그인은 안내만 — 로그인 버튼은 구단주 화면이 카드 밖에 하나만 둔다(T-11-026 잠긴 '내 팀' 카드 안).
    return (
      <View style={head}>
        <View style={who}>
          <Txt style={bTitle}>{L.guestTitle}</Txt>
          <Txt tone="muted" style={bMuted}>
            {L.guestBody}
          </Txt>
        </View>
      </View>
    );
  const label = accountLabel(profile);
  return (
    <View style={{ gap: 12 }}>
      <View style={head}>
        <View style={who}>
          <Txt style={bTitle}>{label.title}</Txt>
          <Txt tone="muted" style={bMuted}>
            {label.via}
          </Txt>
        </View>
        <Btn kind="primary" sm onPress={askLogout} testID="logout">
          {L.logout}
        </Btn>
      </View>
      <View style={{ gap: 6 }}>
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {profile.nickname ? L.nickname : L.nicknamePrompt}
        </Txt>
        {admin ? (
          <Txt style={{ fontSize: rem(0.75), fontWeight: '700' }}>
            {L.nicknameFixed({ nickname: profile.nickname })}
          </Txt>
        ) : (
          <NicknameForm key={profile.nickname ?? ''} current={profile.nickname} />
        )}
      </View>
      <Row gap={6} wrap={false} style={{ justifyContent: 'flex-end' }}>
        {profile.linked.google ? (
          <>
            <LinkBtn onPress={() => void doUnlink()} testID="account-unlink">
              {L.unlinkGoogle}
            </LinkBtn>
            <Txt tone="muted" accessible={false} style={{ fontSize: rem(0.75) }}>
              ·
            </Txt>
          </>
        ) : null}
        <LinkBtn bad onPress={askDelete} testID="account-delete">
          {L.deleteAccount}
        </LinkBtn>
      </Row>
    </View>
  );
}
