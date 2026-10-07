// T-11-150 명예관(웹 ui/owner/OwnerHall.svelte) — 구단주 화면에서 받은 칭호 가운데 대표 칭호를 고른다(자동 · 칭호 하나 ·
// 달지 않기). 고른 칭호는 랭킹 · 팀 프로필 · 댓글 · 채팅 닉네임 옆에 붙는다. 불러오지 못하면 카드를 숨긴다.
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  fetchMyOwnerProfile,
  putOwnerTitle,
  type MyOwnerProfileResponse,
} from '@offside/app-core/api/ownerProfile';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { TITLE_NONE, titleLabel } from '@offside/app-core/ownerTitle';
import { hofStart } from '@offside/app-core/state';
import { TitleBadge } from '../../components/TitleBadge';
import { toast } from '../../game/host';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

export function OwnerHall() {
  const c = useColors();
  const [hall, setHall] = useState<MyOwnerProfileResponse | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchMyOwnerProfile().then((r) => {
      if (live && r.ok) setHall(r.data);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!hall) return null;
  /** 고른 칸 — null = 자동, TITLE_NONE = 달지 않기, 그 밖은 칭호 id. */
  const picked = hall.pinned ? (hall.owner.title ?? TITLE_NONE) : null;

  async function pick(title: string | null) {
    if (!hall || saving || title === picked) return;
    setSaving(true);
    const r = await putOwnerTitle(title);
    setSaving(false);
    if (!r.ok) return toast(r.error.message);
    setHall({ ...hall, owner: { ...hall.owner, title: r.data.title }, pinned: r.data.pinned });
    toast(L.saved);
  }

  const option = (key: string, title: string | null, label: string, body: ReactNode) => {
    const on = picked === title;
    return (
      <Press
        key={key}
        testID={`title-pick-${key}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: on, disabled: saving }}
        accessibilityLabel={label}
        disabled={saving}
        onPress={() => void pick(title)}
        style={{
          gap: 2,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 12,
          borderWidth: on ? 2 : 1,
          borderColor: on ? c.pitchAccent : c.line,
          backgroundColor: c.surface,
        }}
      >
        {body}
      </Press>
    );
  };

  const team = hall.owner.team;
  return (
    <Card gap={12} testID="owner-hall">
      <View style={{ gap: 2 }}>
        <Txt v="eyebrow">Hall of honors</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.hallTitle}
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
          {hall.titles.length ? L.hallLead : L.hallEmpty}
        </Txt>
      </View>
      {hall.titles.length ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              {L.current}
            </Txt>
            {hall.owner.title ? (
              <TitleBadge title={hall.owner.title} />
            ) : (
              <Txt bold>{L.currentNone}</Txt>
            )}
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={L.current}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {option(
              'auto',
              null,
              `${L.pickAuto} · ${L.pickAutoNote}`,
              <>
                <Txt bold>{L.pickAuto}</Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                  {L.pickAutoNote}
                </Txt>
              </>,
            )}
            {hall.titles.map((t) => option(t, t, titleLabel(t) ?? t, <TitleBadge title={t} />))}
            {option('none', TITLE_NONE, L.pickNone, <Txt bold>{L.pickNone}</Txt>)}
          </View>
        </>
      ) : null}
      {team ? (
        <Btn
          block
          testID="my-owner-profile"
          onPress={() => {
            appState.hof = { ...hofStart(), tab: 'teams', team: team.id, owner: true };
            go('hof');
          }}
        >
          {L.viewProfile}
        </Btn>
      ) : null}
    </Card>
  );
}
