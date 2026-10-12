import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
import { saveMemberAppearance, type MemberAppearance } from '@offside/app-core/api/membership';
import {
  memberBilling,
  syncMembership,
  buyMembership,
  restoreMembership,
  manageMembership,
} from '../../platform/membership';
import { Screen, Card, Txt, Btn } from '../../ui';
import { TitleBadge } from '../../components/TitleBadge';
import { go } from '../../game/nav';
export default function Membership() {
  const s = useSnapshot(memberBilling);
  const m = s.data?.membership;
  const [theme, setTheme] = useState<MemberAppearance['theme']>('classic');
  const [frame, setFrame] = useState<MemberAppearance['frame']>('none');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void syncMembership();
  }, []);
  useEffect(() => {
    if (m) {
      setTheme(m.appearance.theme);
      setFrame(m.appearance.frame);
    }
  }, [m?.appearance.theme, m?.appearance.frame]);
  async function save() {
    setSaving(true);
    try {
      const r = await saveMemberAppearance({ theme, frame });
      if (r.ok) {
        memberBilling.data = r.data;
        memberBilling.message = L.saved;
      } else memberBilling.message = r.error.message || L.failed;
    } finally {
      setSaving(false);
    }
  }
  const choices = (values: readonly string[], selected: string, pick: (v: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {values.map((v) => (
        <Btn
          key={v}
          selected={selected === v}
          kind={selected === v ? 'primary' : 'default'}
          style={{ flexGrow: 1, minWidth: 120 }}
          onPress={() => pick(v)}
        >
          {v === 'none' ? L.noFrame : L[v as 'classic']}
        </Btn>
      ))}
    </View>
  );
  return (
    <Screen>
      <Btn onPress={() => go('owner')}>{L.back}</Btn>
      <Card gap={14}>
        <Txt v="h1">{L.title}</Txt>
        <Txt>{L.lead}</Txt>
        {m?.active && m.badge ? <TitleBadge title={`member-${m.badge}`} /> : null}
        {[L.ad, L.items, L.cosmetics, L.compare, L.teams, L.badge].map((text) => (
          <Txt key={text}>{text}</Txt>
        ))}
        <Txt tone="muted">{L.primaryNote}</Txt>
      </Card>
      {s.loading ? <Txt>{L.loading}</Txt> : null}
      {m ? (
        <Card gap={12}>
          <Txt v="h2">{L[m.status]}</Txt>
          {m.paidUntil ? (
            <Txt>
              {m.autoRenew ? L.next : L.until}:{' '}
              {new Date(m.graceUntil ?? m.paidUntil).toLocaleDateString()}
            </Txt>
          ) : null}
          {m.active && !m.autoRenew ? <Txt>{L.cancelled}</Txt> : null}
          {m.active ? (
            <Btn onPress={() => void manageMembership()}>{L.manage}</Btn>
          ) : s.price ? (
            <>
              <Txt v="h2">{s.price}</Txt>
              <Btn kind="primary" disabled={s.busy} onPress={() => void buyMembership()}>
                {L.buy}
              </Btn>
            </>
          ) : (
            <Txt tone="muted">{L.unavailable}</Txt>
          )}
          <Btn disabled={s.busy} onPress={() => void restoreMembership()}>
            {L.restore}
          </Btn>
          <Btn disabled={s.busy || s.loading} onPress={() => void syncMembership(true)}>
            {L.retry}
          </Btn>
          <Txt tone="muted">{L.renewal}</Txt>
        </Card>
      ) : (
        <Btn onPress={() => void syncMembership(true)}>{L.retry}</Btn>
      )}
      {s.message ? <Txt accessibilityLiveRegion="polite">{s.message}</Txt> : null}
      {m?.active ? (
        <Card gap={12}>
          <Txt v="h2">{L.theme}</Txt>
          {choices(['classic', 'midnight', 'ivory', 'royal'], theme, (v) =>
            setTheme(v as typeof theme),
          )}
          <Txt v="h2">{L.frame}</Txt>
          {choices(['none', 'brass', 'silver', 'emerald'], frame, (v) =>
            setFrame(v as typeof frame),
          )}
          <Btn kind="primary" disabled={saving} onPress={() => void save()}>
            {L.save}
          </Btn>
          <Btn onPress={() => go('honors')}>{L.titleGo}</Btn>
          <Btn onPress={() => go('players')}>{L.playersGo}</Btn>
        </Card>
      ) : null}
      {m ? (
        <Card gap={10}>
          <Txt v="h2">{L.history}</Txt>
          {m.grants.length ? (
            m.grants.map((g) => (
              <Txt key={g.period}>
                {new Date(g.at).toLocaleDateString()} · {g.refunded ? L.revoked : L.items}
              </Txt>
            ))
          ) : (
            <Txt tone="muted">{L.noHistory}</Txt>
          )}
        </Card>
      ) : null}
      <Txt tone="muted">{L.keep}</Txt>
      <Btn onPress={() => void Linking.openURL('https://offside-lab.com/legal/terms/')}>
        {L.terms}
      </Btn>
      <Btn onPress={() => void Linking.openURL('https://offside-lab.com/legal/privacy/')}>
        {L.privacy}
      </Btn>
    </Screen>
  );
}
