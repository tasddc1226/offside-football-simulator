// T-11-263 유저 한 명 조회와 아이템 지급·회수(웹 admin/AdminUsers.svelte). 프로필 id · 닉네임 · 친구 코드로 찾아 프로필 · 접속 ·
// 커리어 · 구단 · 컵 · 결제 · 아이템 · 지급 기록을 한 화면에 모은다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminUser } from '@offside/app-core/api/admin';
import type { OwnerItem } from '@offside/contracts/cup';
import {
  GRANT_HELP,
  GRANT_ITEMS,
  ITEM_NAME,
  USER_QUERY_HINT,
  careerLine,
  cupLine,
  deviceLine,
  fundsPurchaseLine,
  grantConfirm,
  grantError,
  grantLine,
  nick,
  purchaseLine,
  sessionLine,
  teamLine,
  userSummary,
} from '@offside/app-core/admin/users';
import { toast } from '../../../game/host';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';
import { Seg, TabOpt, TextBox } from '../../board/parts';

export default function AdminUsers() {
  const c = useColors();
  const [q, setQ] = useState('');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState<OwnerItem>('reroll');
  const [deltaText, setDeltaText] = useState('1');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const delta = Number(deltaText);

  async function find(query = q) {
    const v = query.trim();
    if (!v) return;
    setQ(v);
    setMsg('');
    setBusy(true);
    const r = await api.fetchAdminUser(v);
    setBusy(false);
    setUser(r.ok ? r.data : null);
    if (!r.ok) setMsg(r.error.message || '유저를 찾지 못했어요.');
  }
  async function grant(u: AdminUser) {
    setBusy(true);
    const r = await api.grantAdminItem(u.profile.id, {
      item,
      delta,
      reason: reason.trim(),
      notify: delta > 0 && notify,
    });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    toast(`${ITEM_NAME[item]} ${r.data.qty}장이 됐어요.`);
    setReason('');
    await find(u.profile.id);
  }
  function askGrant(u: AdminUser) {
    const err = grantError(delta, reason);
    if (err) return toast(err);
    Alert.alert('아이템 지급·회수', grantConfirm(u, item, delta), [
      { text: delta < 0 ? '회수' : '지급', onPress: () => void grant(u) },
      { text: '취소', style: 'cancel' },
    ]);
  }

  const small = { fontSize: rem(FONT.label) } as const;
  const tiny = { fontSize: rem(FONT.caption) } as const;
  const line = { paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line } as const;
  const section = (title: string, lines: string[], key: string) => (
    <View key={key} testID={`user-section-${key}`} style={{ gap: 4 }}>
      <Txt bold style={small}>
        {title}
      </Txt>
      {lines.length ? (
        lines.map((l, i) => (
          <View key={i} style={line}>
            <Txt style={small}>{l}</Txt>
          </View>
        ))
      ) : (
        <Txt tone="muted" style={small}>
          없어요.
        </Txt>
      )}
    </View>
  );
  const u = user;
  return (
    <View testID="admin-users" style={{ gap: 14 }}>
      <Txt v="h2" accessibilityRole="header">
        유저 조회
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextBox
            testID="user-query"
            value={q}
            onChangeText={setQ}
            placeholder={USER_QUERY_HINT}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void find()}
          />
        </View>
        <Btn sm testID="find-user" disabled={busy} onPress={() => void find()}>
          찾기
        </Btn>
      </View>
      {msg ? (
        <Txt tone="muted" style={small}>
          {msg}
        </Txt>
      ) : null}
      {u ? (
        <View
          testID={`user-${u.profile.id}`}
          style={{
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: RADIUS.md,
          }}
        >
          <View>
            <Txt bold>
              {nick(u.profile.nickname)}
              {u.profile.deletedAt ? ' · 삭제된 프로필' : ''}
            </Txt>
            <Txt tone="muted" selectable style={tiny}>
              {u.profile.id}
            </Txt>
          </View>
          <View>
            {userSummary(u).map(([label, v]) => (
              <View
                key={label}
                style={[line, { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }]}
              >
                <Txt tone="muted" style={small}>
                  {label}
                </Txt>
                <Txt style={[small, { flexShrink: 1, textAlign: 'right' }]}>{v}</Txt>
              </View>
            ))}
          </View>

          {!u.profile.deletedAt ? (
            <View testID="user-grant" style={{ gap: 8 }}>
              <Txt bold style={small}>
                아이템 지급·회수
              </Txt>
              <Seg cols={3} label="아이템">
                {GRANT_ITEMS.map((it) => (
                  <TabOpt
                    key={it}
                    tight
                    title={`${ITEM_NAME[it]} ${u.items[it] ?? 0}`}
                    selected={item === it}
                    testID={`grant-item-${it}`}
                    onPress={() => setItem(it)}
                  />
                ))}
              </Seg>
              <TextBox
                testID="grant-delta"
                value={deltaText}
                onChangeText={setDeltaText}
                placeholder="장수(회수는 −)"
                keyboardType="numbers-and-punctuation"
              />
              <TextBox
                testID="grant-reason"
                value={reason}
                onChangeText={setReason}
                placeholder="사유(운영 기록에 남아요)"
                maxLength={200}
              />
              {delta > 0 ? (
                <Seg cols={2} label="지급 알림">
                  <TabOpt
                    tight
                    title="알림 보내기"
                    selected={notify}
                    testID="grant-notify-on"
                    onPress={() => setNotify(true)}
                  />
                  <TabOpt
                    tight
                    title="알림 없이"
                    selected={!notify}
                    testID="grant-notify-off"
                    onPress={() => setNotify(false)}
                  />
                </Seg>
              ) : null}
              <Btn sm testID="grant-item" disabled={busy} onPress={() => askGrant(u)}>
                {delta < 0 ? '회수하기' : '지급하기'}
              </Btn>
              <Txt tone="muted" style={tiny}>
                {GRANT_HELP}
              </Txt>
            </View>
          ) : null}

          {section(
            '접속',
            [
              ...u.sessions.map(sessionLine),
              ...u.devices.map((d) => `푸시 기기 · ${deviceLine(d)}`),
            ],
            'sessions',
          )}
          {section('앱 결제', u.purchases.map(purchaseLine), 'purchases')}
          {section('운영 지급·회수', u.grants.map(grantLine), 'grants')}
          {section('구단 자금으로 산 것', u.fundsPurchases.map(fundsPurchaseLine), 'funds')}
          {section('구단', u.teams.map(teamLine), 'teams')}
          {section('오프사이드 컵', u.cups.map(cupLine), 'cups')}
          {section('최근 커리어', u.careers.recent.map(careerLine), 'careers')}
        </View>
      ) : null}
    </View>
  );
}
