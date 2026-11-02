// T-11-618 남의 명예관의 칭호 칸(웹 owner/OwnerHallVisit.svelte) — 받은 칭호만 묶음별로 보여 준다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { View } from 'react-native';
import {
  titleLabel,
  titleCondition,
  permanentTitleOf,
  titleKindLabel,
  titleCategoryLabel,
} from '@offside/app-core/ownerTitle';
import { titleGroups, titleTierText } from '@offside/app-core/ownerTitleCollection';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { TitleBadge } from '../../components/TitleBadge';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Txt } from '../../ui';

export function OwnerHallVisit({
  title,
  titles,
}: {
  title: string | null;
  titles: readonly string[];
}) {
  const c = useColors();
  const small = { fontSize: rem(FONT.label), lineHeight: rem(FONT.title2) };
  const groups = titleGroups({ titles: [...titles], permanent: [] }).earned;
  if (!groups.length) return <Txt tone="muted">{L.visitNoTitles}</Txt>;
  return (
    <View testID="owner-hall-visit" style={{ gap: 18 }}>
      {groups.map((g) => (
        <View key={g.key} testID={`title-group-${g.key}`} style={{ gap: 10 }}>
          <Txt v="h2" accessibilityRole="header">
            {titleCategoryLabel(g.key)} {g.ids.length}
          </Txt>
          {g.ids.map((id) => {
            const def = permanentTitleOf(id);
            const tier = titleTierText(id);
            return (
              <View
                key={id}
                testID={`visit-title-${id}`}
                style={{
                  padding: 12,
                  gap: 6,
                  borderRadius: RADIUS.md,
                  borderWidth: 1,
                  borderColor: title === id ? c.accent : c.line,
                  backgroundColor: c.surface,
                }}
              >
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                >
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <TitleBadge title={id} size="icon" />
                  </View>
                  <Txt bold>{titleLabel(id)}</Txt>
                  <Txt tone="muted" style={small}>
                    {titleKindLabel(id)}
                    {tier ? ` · ${tier}` : ''}
                  </Txt>
                  {title === id ? (
                    <Txt style={{ ...small, color: c.accentText }}>✓ {L.titleUsing}</Txt>
                  ) : null}
                </View>
                {def ? (
                  <Txt tone="muted" style={small}>
                    {titleCondition(id)}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
