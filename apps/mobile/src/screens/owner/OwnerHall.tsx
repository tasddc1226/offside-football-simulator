import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  fetchOwnerTitles,
  putOwnerTitle,
  type OwnerTitlesResponse,
} from '@offside/app-core/api/ownerProfile';
import {
  TITLE_NONE,
  titleLabel,
  titleCondition,
  permanentTitleOf,
  titleGradeLabel,
  titleRelated,
} from '@offside/app-core/ownerTitle';
import { titleCollection } from '@offside/app-core/ownerTitleCollection';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { TitleBadge } from '../../components/TitleBadge';
import { toast } from '../../game/host';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Txt } from '../../ui';

export function OwnerHall({ onpick }: { onpick?: (title: string | null) => void }) {
  const [hall, setHall] = useState<OwnerTitlesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'earned' | 'locked' | null>(null);
  const [guide, setGuide] = useState(false);
  const c = useColors();
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
    ) : (
      <Txt tone="muted" accessibilityLiveRegion="polite">
        {L.titleLoading}
      </Txt>
    );
  const picked = hall.pinned ? (hall.title ?? TITLE_NONE) : null;
  const collection = titleCollection(hall);
  const shown = filter ?? (collection.earned.length ? 'earned' : 'locked');
  const small = { fontSize: rem(0.8), lineHeight: rem(1.25) };
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
  const identity = (id: string, isNew = false) => {
    const grade = permanentTitleOf(id)?.grade;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: c.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TitleBadge title={id} size="icon" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt bold style={{ fontSize: rem(1) }}>
            {titleLabel(id)}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Txt tone="muted" style={small}>
              {grade ? titleGradeLabel(grade) : L.titleCup}
            </Txt>
            {isNew ? <Txt style={{ ...small, color: c.accentText }}>{L.newTitle}</Txt> : null}
          </View>
        </View>
      </View>
    );
  };
  const itemStyle = {
    padding: 16,
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  };
  return (
    <View testID="owner-hall" style={{ gap: 16 }}>
      <Card gap={12} style={{ borderTopWidth: 2, borderTopColor: c.accent }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Txt tone="muted" style={small}>
            {L.current}
          </Txt>
          {hall.title ? (
            <Press
              testID="title-pick-none"
              accessibilityLabel={L.pickNone}
              accessibilityState={{
                selected: picked === TITLE_NONE,
                disabled: saving || !hall.title,
              }}
              disabled={saving || !hall.title}
              onPress={() => void pick(TITLE_NONE)}
              style={{
                minHeight: 48,
                paddingHorizontal: 12,
                justifyContent: 'center',
                opacity: hall.title ? 1 : 0.45,
              }}
            >
              <Txt tone="muted" style={{ ...small, textDecorationLine: 'underline' }}>
                {L.titleRemove}
              </Txt>
            </Press>
          ) : null}
        </View>
        {hall.title ? identity(hall.title) : <Txt bold>{L.currentNone}</Txt>}
        <Txt tone="muted" style={small}>
          {L.titleDisplayHint}
        </Txt>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['earned', 'locked'] as const).map((key) => (
          <Press
            key={key}
            testID={`title-filter-${key}`}
            accessibilityState={{ selected: shown === key }}
            onPress={() => setFilter(key)}
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              minHeight: 48,
              paddingHorizontal: 14,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: shown === key ? c.accent : c.line,
              backgroundColor: shown === key ? c.surface2 : 'transparent',
            }}
          >
            <Txt bold>{key === 'earned' ? L.collectionEarned : L.collectionLocked}</Txt>
            <Txt tone="muted" num>
              {collection[key].length}
            </Txt>
          </Press>
        ))}
      </View>
      <Txt tone="muted" style={small}>
        {shown === 'earned' ? L.collectionHint : L.challengeHint}
      </Txt>
      <View style={{ gap: 10 }} accessibilityState={{ busy: saving }}>
        {shown === 'earned' ? (
          collection.earned.length ? (
            collection.earned.map((id) => {
              const t = hall.permanent.find((p) => p.id === id);
              return (
                <Press
                  key={id}
                  testID={`title-pick-${id}`}
                  scale={0.985}
                  accessibilityLabel={`${titleLabel(id)} · ${L.equip}`}
                  accessibilityState={{ selected: hall.title === id, disabled: saving }}
                  disabled={saving}
                  onPress={() => void pick(id)}
                  style={{ ...itemStyle, borderColor: hall.title === id ? c.accent : c.line }}
                >
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                  >
                    {identity(id, t?.isNew)}
                    {hall.title === id ? (
                      <Txt style={{ ...small, color: c.accentText }}>✓ {L.titleUsing}</Txt>
                    ) : null}
                  </View>
                  {t ? (
                    <Txt tone="muted" style={small}>
                      {titleCondition(id)}
                    </Txt>
                  ) : null}
                </Press>
              );
            })
          ) : (
            <Txt tone="muted">{L.hallEmpty}</Txt>
          )
        ) : collection.locked.length ? (
          collection.locked.map((t) => (
            <View key={t.id} testID={`permanent-title-${t.id}`} style={itemStyle}>
              {identity(t.id)}
              <Txt tone="muted" style={small}>
                {titleCondition(t.id)}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={titleLabel(t.id) ?? t.id}
                  accessibilityValue={{ min: 0, max: t.target, now: Math.min(t.value, t.target) }}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 6,
                    overflow: 'hidden',
                    backgroundColor: c.surface2,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, (t.value / t.target) * 100)}%`,
                      height: 5,
                      backgroundColor: c.accent,
                    }}
                  />
                </View>
                <Txt num style={small}>
                  {L.progress(t)}
                </Txt>
              </View>
              <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                {titleRelated(t.id)}
              </Txt>
            </View>
          ))
        ) : (
          <Txt tone="muted">{L.titleAllEarned}</Txt>
        )}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
        <Press
          accessibilityState={{ expanded: guide }}
          onPress={() => setGuide(!guide)}
          style={{
            minHeight: 48,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Txt tone="muted">{L.titleGuide}</Txt>
          <Txt tone="muted">{guide ? '−' : '+'}</Txt>
        </Press>
        {guide ? (
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <Txt tone="muted" style={small}>
              {L.permanentLead}
            </Txt>
            <Txt tone="muted" style={small}>
              {L.titleBridge}
            </Txt>
            <Btn
              testID="title-season-achievements"
              onPress={() => {
                appState.teamView = 'achievements';
                go('team');
              }}
            >
              {L.viewAchievements}
            </Btn>
            {collection.cups.length ? (
              <>
                <Btn testID="title-pick-auto" disabled={saving} onPress={() => void pick(null)}>
                  {L.titleAutoCup}
                </Btn>
                <Txt tone="muted" style={small}>
                  {L.pickAutoNote}
                </Txt>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
