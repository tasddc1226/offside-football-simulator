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
import { accountCache } from '../../store';
import { isMember } from '../../game/account';
import { closeSheet, refreshAccount, showSheet } from '../../game/host';
import { setSessionToken } from '../../platform/session';
import { rem } from '../../theme/type';
import { NicknameForm } from '../../components/NicknameForm';
import { Btn, Row, Txt } from '../../ui';
import { LinkBtn } from '../settings/parts';

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
  set(null);
}
function askLogout() {
  showSheet(
    {
      kind: 'notice',
      eyebrow: 'Account',
      title: '로그아웃할까요?',
      muted: true,
      text: '이 기기에 저장된 게임 진행은 그대로 남아요. 같은 구글 계정으로 다시 로그인하면 계정에 저장된 기록을 다시 볼 수 있어요.',
    },
    [
      { label: '로그아웃', cls: 'btn-primary', fn: () => void doLogout() },
      { label: '취소', fn: closeSheet },
    ],
  );
}
/** 계정 삭제(스토어 심사 필수): 확인 → 삭제 시작(확인 토큰) → 삭제 확정. 끝나면 세션 토큰도 지운다. */
async function doDeleteFlow() {
  const start = await startProfileDeletion();
  if (!start.ok) return set('error');
  const done = await confirmProfileDeletion(start.data.confirmToken);
  if (done.ok) await setSessionToken(null);
  set(done.ok ? null : 'error');
}
function askDelete() {
  Alert.alert(
    '계정 삭제',
    '정말 계정을 삭제할까요? 이 기기의 게임 저장 데이터는 남지만, 계정 연동은 완전히 사라집니다.',
    [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void doDeleteFlow() },
    ],
  );
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
          <Txt style={bTitle}>계정</Txt>
          <Txt tone="muted" style={bMuted}>
            확인 중…
          </Txt>
        </View>
      </View>
    );
  if (profile === 'error')
    return (
      <View style={head}>
        <View style={who}>
          <Txt style={bTitle}>연결할 수 없어요</Txt>
          <Txt tone="muted" style={bMuted}>
            서버에 연결하지 못해 로그인 상태를 확인하지 못했어요. 게임은 계속 즐길 수 있고, 저장은
            이 기기에 남습니다.
          </Txt>
        </View>
        <Btn sm onPress={() => void load()} testID="account-retry">
          다시 시도
        </Btn>
      </View>
    );
  if (!profile || !isMember(profile))
    // T-10-102 비로그인은 안내만 — 로그인 버튼은 구단주 화면이 카드 밖에 하나만 둔다.
    return (
      <View style={head}>
        <View style={who}>
          <Txt style={bTitle}>로그인하지 않았어요</Txt>
          <Txt tone="muted" style={bMuted}>
            로그인하면 은퇴한 선수로 내 팀을 꾸려 다른 구단주와 겨루고, 선수 기록과 구단 이름을 다른
            기기에서도 볼 수 있어요. 게임 진행은 이 기기에만 저장됩니다.
          </Txt>
        </View>
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      <View style={head}>
        <View style={who}>
          <Txt style={bTitle}>
            {profile.linked.google ? (profile.googleEmailMasked ?? '구글 계정') : 'Apple 계정'}
          </Txt>
          <Txt tone="muted" style={bMuted}>
            {profile.linked.google ? 'Google' : 'Apple'} 계정으로 로그인했어요.
          </Txt>
        </View>
        <Btn kind="primary" sm onPress={askLogout} testID="logout">
          로그아웃
        </Btn>
      </View>
      <View style={{ gap: 6 }}>
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {`댓글 닉네임${profile.nickname ? '' : ' — 정하면 소식 게시판에 댓글을 쓸 수 있어요'}`}
        </Txt>
        {admin ? (
          <Txt style={{ fontSize: rem(0.75), fontWeight: '700' }}>
            {`${profile.nickname} · 운영자 계정은 고정이에요`}
          </Txt>
        ) : (
          <NicknameForm key={profile.nickname ?? ''} current={profile.nickname} />
        )}
      </View>
      <Row gap={6} wrap={false} style={{ justifyContent: 'flex-end' }}>
        {profile.linked.google ? (
          <>
            <LinkBtn onPress={() => void doUnlink()} testID="account-unlink">
              구글 연동 해제
            </LinkBtn>
            <Txt tone="muted" accessible={false} style={{ fontSize: rem(0.75) }}>
              ·
            </Txt>
          </>
        ) : null}
        <LinkBtn bad onPress={askDelete} testID="account-delete">
          계정 삭제
        </LinkBtn>
      </Row>
    </View>
  );
}
