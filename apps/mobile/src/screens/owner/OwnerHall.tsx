// T-11-150 명예관(웹 ui/owner/OwnerHall.svelte) — 구단주 화면에서 받은 칭호 가운데 대표 칭호를 고른다(자동 · 칭호 하나 ·
// 달지 않기). 고른 칭호는 랭킹 · 팀 프로필 · 댓글 · 채팅 닉네임 옆에 붙는다. 불러오지 못하면 카드를 숨긴다.
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  fetchOwnerTitles,
  putOwnerTitle,
  type OwnerTitlesResponse,
} from '@offside/app-core/api/ownerProfile';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { TITLE_NONE, titleLabel, titleCondition, parseTitle } from '@offside/app-core/ownerTitle';
import { hofStart } from '@offside/app-core/state';
import { TitleBadge } from '../../components/TitleBadge';
import { toast } from '../../game/host';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Opt } from '../../ui/bits';
import { Txt } from '../../ui/Txt';

export function OwnerHall({ onpick }: { onpick?: (title: string | null) => void }) {
  const [hall, setHall] = useState<OwnerTitlesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchOwnerTitles().then((r) => {
      if (!live) return;
      if (r.ok) setHall(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!hall)
    return failed ? (
      <Card gap={12} testID="owner-hall-error">
        <Txt v="h2">{L.hallTitle}</Txt>
        <Txt>{L.hallLoadFail}</Txt>
        <Btn
          onPress={() => {
            setFailed(false);
            void fetchOwnerTitles().then((r) => {
              if (r.ok) setHall(r.data);
              else setFailed(true);
            });
          }}
        >
          {L.retry}
        </Btn>
      </Card>
    ) : null;
  /** 고른 칸 — null = 자동, TITLE_NONE = 달지 않기, 그 밖은 칭호 id. */
  const picked = hall.pinned ? (hall.title ?? TITLE_NONE) : null;

  async function pick(title: string | null) {
    if (!hall || saving || title === picked) return;
    setSaving(true);
    const r = await putOwnerTitle(title);
    setSaving(false);
    if (!r.ok) return toast(r.error.message);
    setHall({
      ...hall,
      title: r.data.title,
      pinned: r.data.pinned,
      permanent: hall.permanent.map((t) => (t.id === title ? { ...t, isNew: false } : t)),
    });
    onpick?.(r.data.title);
    toast(L.saved);
  }

  const option = (key: string, title: string | null, label: string, body: ReactNode) => (
    <Opt
      key={key}
      testID={`title-pick-${key}`}
      selected={picked === title}
      disabled={saving}
      accessibilityLabel={label}
      onPress={() => void pick(title)}
    >
      {body}
    </Opt>
  );

  const teamId = hall.teamId;
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
            {hall.title ? <TitleBadge title={hall.title} /> : <Txt bold>{L.currentNone}</Txt>}
          </View>
          <View
            accessibilityRole="none"
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
            {hall.titles
              .filter((id) => parseTitle(id))
              .map((t) => option(t, t, titleLabel(t) ?? t, <TitleBadge title={t} />))}
            {option('none', TITLE_NONE, L.pickNone, <Txt bold>{L.pickNone}</Txt>)}
          </View>
        </>
      ) : null}
      <View style={{ gap: 12 }}>
        <Txt v="h2" accessibilityRole="header">
          {L.permanentTitle}
        </Txt>
        <Txt tone="muted">{L.permanentLead}</Txt>
        {hall.permanent.map((t) => (
          <View
            key={t.id}
            testID={`permanent-title-${t.id}`}
            style={{ gap: 8, paddingVertical: 8 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TitleBadge title={t.id} />
              {t.isNew ? <Txt tone="muted">{L.newTitle}</Txt> : null}
            </View>
            <Txt tone="muted">{titleCondition(t.id)}</Txt>
            {t.earnedAt ? (
              option(
                t.id,
                t.id,
                titleLabel(t.id) ?? t.id,
                <Txt bold>{picked === t.id ? L.selected : L.equip}</Txt>,
              )
            ) : (
              <Txt tone="muted" accessibilityLabel={`${L.locked} ${L.progress(t)}`}>
                {L.progress(t)}
              </Txt>
            )}
          </View>
        ))}
      </View>
      {teamId ? (
        <Btn
          block
          testID="my-owner-profile"
          onPress={() => {
            appState.hof = { ...hofStart(), tab: 'teams', team: teamId, owner: true };
            go('hof');
          }}
        >
          {L.viewProfile}
        </Btn>
      ) : null}
    </Card>
  );
}
