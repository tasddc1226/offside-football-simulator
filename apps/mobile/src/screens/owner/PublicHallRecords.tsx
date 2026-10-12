import { View } from 'react-native';
import type { PublicOwnerHall } from '@offside/app-core/api/ownerProfile';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { seasonLabel } from '@offside/app-core/seasonName';
import { num } from '@offside/app-core/teamText';
import { Card, Txt } from '../../ui';
import { TitleBadge } from '../../components/TitleBadge';

export function PublicHallRecords({
  data,
  titles = false,
}: {
  data: PublicOwnerHall;
  titles?: boolean;
}) {
  return (
    <View testID="public-hall-content" style={{ gap: 14 }}>
      <Txt tone="muted">{L.publicHall}</Txt>
      <Txt v="h2">{titles ? L.publicTitles : L.seasons}</Txt>
      {titles ? (
        data.titles.length ? (
          data.titles.map((title) => (
            <Card key={title}>
              <TitleBadge title={title} />
            </Card>
          ))
        ) : (
          <Txt tone="muted">{L.publicTitlesEmpty}</Txt>
        )
      ) : data.owner.seasons.length ? (
        [...data.owner.seasons].reverse().map((s) => (
          <Card key={s.season} gap={8}>
            <Txt bold>
              {seasonLabel(s.season, s.name)}
              {!s.closed ? ` · ${L.ongoing}` : ''}
            </Txt>
            <Txt>{s.teamName ?? L.none}</Txt>
            {data.pendingSeasons.includes(s.season) ? (
              <Txt tone="muted">{L.publicPending}</Txt>
            ) : (
              <>
                <Txt>
                  {L.colAch}: {s.achScore === null ? L.none : num(s.achScore)}
                </Txt>
                <Txt>
                  {L.colRank}: {s.teamRank === null ? L.none : L.rank({ n: s.teamRank })}
                </Txt>
              </>
            )}
          </Card>
        ))
      ) : (
        <Txt tone="muted">{L.seasonsEmpty}</Txt>
      )}
    </View>
  );
}
