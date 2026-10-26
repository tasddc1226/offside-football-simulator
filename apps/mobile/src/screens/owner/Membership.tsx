// T-11-512 클럽 멤버십(내 구단 화면 '클럽 멤버십' 칸으로 연다, 웹 owner/Membership.svelte). 열 때 한 번 상태(1분 메모)를 받고,
// 서버가 이 스토어에서 가입을 받으면 스토어 가격을 묻는다. 해지는 스토어 구독 관리로 보낸다.
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchMembership } from '@offside/app-core/api/membership';
import { RADIUS } from '@offside/app-core/design-tokens';
import { needsOwnerLogin } from '@offside/app-core/market';
import {
  MEMBER_MANAGE_URL,
  memberPerks,
  memberStatusText,
} from '@offside/app-core/membership-view';
import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
import { settingsText as SL } from '@offside/app-core/i18n/ko/settings';
import { MEMBERSHIP_PRODUCT_ID } from '@offside/contracts/membership';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { WEB_ORIGIN } from '../../platform/config';
import {
  joinMembership,
  membership,
  restoreMembership,
  syncMembershipStore,
} from '../../platform/membership';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, PitchCard, Pill, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';

const PACKAGE = 'com.offsidelab.app';
const manageUrl = () =>
  Platform.OS === 'ios'
    ? MEMBER_MANAGE_URL.apple
    : MEMBER_MANAGE_URL.google(MEMBERSHIP_PRODUCT_ID, PACKAGE);

export function Membership({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const s = useSnapshot(membership);
  const [status, setStatus] = useState<LoadStatus | 'login'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await fetchMembership();
    if (!r.ok) return setStatus(needsOwnerLogin(r.error) ? 'login' : 'error');
    setStatus('ready');
    void syncMembershipStore(r.data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const m = s.state;
  const line = m ? memberStatusText(m) : null;

  return (
    <PopSheet label={L.title} step={m ? 'member' : 'load'} testID="membership" onClose={onClose}>
      <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="h2" style={{ flex: 1 }}>
            {L.title}
          </Txt>
          <Btn sm testID="member-close" onPress={onClose}>
            {L.back}
          </Btn>
        </View>
        {status === 'login' ? (
          <Txt>{L.login}</Txt>
        ) : (
          <LoadState status={status} failText={L.loadFail} retry={() => void load()} rows={5}>
            {m ? (
              <View style={{ gap: 12 }}>
                <PitchCard gap={8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt tone="onPitch" bold style={{ flex: 1 }}>
                      {m.active ? L.active : L.lead}
                    </Txt>
                    {m.active ? <Pill tone="good">{L.badge}</Pill> : null}
                  </View>
                  {line ? (
                    <Txt tone="onPitch" style={{ fontSize: rem(0.875), opacity: 0.85 }}>
                      {line}
                    </Txt>
                  ) : null}
                </PitchCard>
                {memberPerks().map((p) => (
                  <View
                    key={p.key}
                    style={{
                      gap: 2,
                      padding: 12,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: c.line,
                      backgroundColor: c.surface,
                    }}
                  >
                    <Txt bold>{p.title}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                      {p.sub}
                    </Txt>
                  </View>
                ))}
                {m.active ? (
                  <View style={{ gap: 6 }}>
                    <Btn
                      block
                      testID="member-manage"
                      onPress={() => void Linking.openURL(manageUrl())}
                    >
                      {L.manage}
                    </Btn>
                    <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                      {L.manageHint}
                    </Txt>
                  </View>
                ) : s.price ? (
                  <View style={{ gap: 6 }}>
                    <Btn
                      kind="accent"
                      block
                      testID="member-join"
                      disabled={s.busy}
                      onPress={() => void joinMembership()}
                    >
                      {s.busy ? L.joinBusy : L.join({ price: s.price })}
                    </Btn>
                    <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                      {L.renewNote}
                    </Txt>
                  </View>
                ) : m.stores.length === 0 ? (
                  <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                    {L.notOnSale}
                  </Txt>
                ) : null}
                {!m.active ? (
                  <Btn
                    sm
                    kind="ghost"
                    testID="member-restore"
                    disabled={s.restoring}
                    onPress={() => void restoreMembership()}
                  >
                    {s.restoring ? L.restoreBusy : L.restore}
                  </Btn>
                ) : null}
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {L.adOwned}
                </Txt>
                {/* 구독 화면에는 이용약관 · 개인정보 처리방침 링크를 둔다(App Store 심사 3.1.2). */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn
                    sm
                    kind="ghost"
                    onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/terms/`)}
                  >
                    {SL.terms}
                  </Btn>
                  <Btn
                    sm
                    kind="ghost"
                    onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/privacy/`)}
                  >
                    {SL.privacy}
                  </Btn>
                </View>
              </View>
            ) : null}
          </LoadState>
        )}
      </View>
    </PopSheet>
  );
}
