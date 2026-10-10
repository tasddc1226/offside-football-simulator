import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { OwnerArchive as Archive } from '@offside/app-core/ownerArchive';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { honorViews } from '@offside/app-core/seasonRecap';
import { ownerTierOf } from '@offside/contracts/owner-tier';
import { tierName } from '@offside/app-core/ownerTier';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { num } from '@offside/app-core/teamText';
import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';
import { appState, prefs } from '../../store';
import { go } from '../../game/nav';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { GradeEmblem } from '../../ui/GradeEmblem';
import { HonorEmblem } from '../../components/HonorEmblem';
import { CupHonors } from '../../components/CupHonors';
import { Btn, Card, Press, Txt } from '../../ui';
import SeasonRecap from './SeasonRecap';

export function OwnerArchive() {
  const [archive] = useState(() => new Archive());
  const [state, setState] = useState(archive.state);
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const unsubscribe = archive.subscribe(setState);
    void archive.load(appState.honorsSeason);
    return () => {
      unsubscribe();
      archive.dispose();
    };
  }, [archive]);
  useEffect(() => {
    if (!motionOK) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [state.season, motionOK, opacity]);
  const owner = state.data?.owner;
  const line = owner?.seasons.find((s) => s.season === state.season);
  const pending = state.data?.pendingSeasons.includes(state.season ?? -1);
  const badges = honorViews(state.data?.honors.filter((h) => h.season === state.season) ?? []);
  const cups = owner?.cupHonors.filter((h) => h.season === state.season) ?? [];
  const tier = line?.achScore == null ? null : ownerTierOf(line.achScore);
  const small = { fontSize: rem(0.8) };
  const expand = async (retry = false) => {
    await archive.expand(retry);
    if (archive.state.detail?.status === 'ready') appState.recapNew = false;
  };
  if (state.loading)
    return (
      <Txt tone="muted" accessibilityLiveRegion="polite">
        {L.archiveLoading}
      </Txt>
    );
  if (state.error)
    return (
      <Card gap={12} testID="archive-error">
        <Txt>{L.archiveError}</Txt>
        <Btn onPress={() => void archive.load(appState.honorsSeason)}>{L.retry}</Btn>
      </Card>
    );
  if (!owner) return null;
  return (
    <View style={{ gap: 16 }} testID="owner-archive">
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 14,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: c.line,
        }}
      >
        {[
          [L.statRetired, owner.stats.retired],
          [L.statRn, owner.stats.retiredNumbers],
          [L.archiveBadges, state.data?.honors.length ?? 0],
        ].map(([label, value]) => (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Txt tone="muted" center style={small}>
              {label}
            </Txt>
            <Txt num={700} style={{ fontSize: rem(1.4) }}>
              {num(Number(value))}
            </Txt>
          </View>
        ))}
      </View>
      <View accessibilityLabel={L.archiveChoose} style={{ gap: 4 }}>
        {[...owner.seasons].reverse().map((s) => (
          <Press
            key={s.season}
            testID={`archive-season-${s.season}`}
            accessibilityState={{ selected: state.season === s.season }}
            onPress={() => {
              appState.honorsSeason = s.season;
              archive.select(s.season);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 64,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: state.season === s.season ? c.line : 'transparent',
              backgroundColor: state.season === s.season ? c.surface2 : 'transparent',
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: c.muted,
                backgroundColor: state.season === s.season ? c.accent : 'transparent',
              }}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt bold>{teamSeasonLabel(s.season)}</Txt>
              <Txt tone="muted" style={small}>
                {state.data?.pendingSeasons.includes(s.season)
                  ? L.archivePending
                  : s.closed
                    ? L.archiveClosed
                    : L.ongoing}
              </Txt>
            </View>
            {s.achScore !== null ? (
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Txt num={600}>{num(s.achScore)}</Txt>
                <Txt tone="muted" style={small}>
                  {L.archiveScore}
                </Txt>
              </View>
            ) : null}
          </Press>
        ))}
      </View>
      {line ? (
        <Animated.View style={{ opacity, gap: 16 }}>
          <Card
            gap={14}
            testID="archive-cover"
            style={{
              borderTopWidth: 3,
              borderTopColor: tier ? EMBLEM_PALETTE[tier].base : c.accent,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Txt tone="muted" style={small}>
                  {pending ? L.archivePending : line.closed ? L.archiveClosed : L.ongoing}
                </Txt>
                <Txt v="h1" accessibilityRole="header">
                  {teamSeasonLabel(line.season)}
                </Txt>
                {line.teamName ? <Txt bold>{line.teamName}</Txt> : null}
              </View>
              {tier ? (
                <View style={{ alignItems: 'center', gap: 3 }}>
                  <GradeEmblem id={tier} size={72} />
                  <Txt bold style={small}>
                    {tierName(tier)}
                  </Txt>
                </View>
              ) : null}
            </View>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: c.line,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Txt tone="muted" style={small}>
                  {L.archiveScore}
                </Txt>
                <Txt num={700} style={{ fontSize: rem(1.6) }}>
                  {line.achScore === null ? L.none : num(line.achScore)}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt tone="muted" style={small}>
                  {L.archiveTeamRank}
                </Txt>
                <Txt num={700} style={{ fontSize: rem(1.6) }}>
                  {line.teamRank === null ? L.none : L.rank({ n: line.teamRank })}
                </Txt>
              </View>
            </View>
            <Txt tone="muted" style={small}>
              {pending ? L.archivePendingNote : line.closed ? L.archiveFinal : L.archiveLive}
            </Txt>
          </Card>
          {line.closed && !pending ? (
            <Card gap={14}>
              <Txt v="h2" accessibilityRole="header">
                {L.archiveBadges}
              </Txt>
              {badges.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
                  {badges.map((h) => (
                    <View
                      key={h.kind}
                      style={{
                        width: '33.333%',
                        alignItems: 'center',
                        paddingHorizontal: 3,
                        gap: 5,
                      }}
                    >
                      <HonorEmblem h={h} size={64} />
                      <Txt center bold style={small}>
                        {h.title}
                      </Txt>
                      <Txt center tone="muted" style={small}>
                        {h.detail}
                      </Txt>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt tone="muted" style={small}>
                  {L.archiveNoBadges}
                </Txt>
              )}
            </Card>
          ) : null}
          {cups.length ? (
            <CupHonors honors={cups} />
          ) : (
            <Txt tone="muted" style={small}>
              {L.archiveCupEmpty}
            </Txt>
          )}
          <View style={{ gap: 8 }}>
            <Btn
              block
              testID="archive-players"
              onPress={() => {
                appState.playersSeason = state.season;
                appState.playersView = 'records';
                go('players');
              }}
            >
              {L.archivePlayers}
            </Btn>
            {!line.closed ? (
              <Btn
                block
                testID="archive-achievements"
                onPress={() => {
                  appState.teamView = 'achievements';
                  go('team');
                }}
              >
                {L.viewAchievements}
              </Btn>
            ) : null}
          </View>
          {line.closed ? (
            <>
              <Press
                testID="archive-details"
                accessibilityState={{ expanded: state.expanded }}
                onPress={() => void expand()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 16,
                  minHeight: 52,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 12,
                  backgroundColor: c.surface,
                }}
              >
                <Txt bold style={{ flex: 1 }}>
                  {state.expanded ? L.archiveHide : L.archiveDetails}
                </Txt>
                <Txt>{state.expanded ? '−' : '+'}</Txt>
              </Press>
              {state.expanded ? (
                <View style={{ gap: 14 }}>
                  {state.detailLoading ? (
                    <Txt tone="muted" accessibilityLiveRegion="polite">
                      {L.archiveLoading}
                    </Txt>
                  ) : state.detailError ? (
                    <>
                      <Txt>{L.archiveError}</Txt>
                      <Btn testID="archive-retry" onPress={() => void expand(true)}>
                        {L.retry}
                      </Btn>
                    </>
                  ) : state.detail ? (
                    <SeasonRecap record={state.detail} />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      ) : (
        <Txt tone="muted">{L.seasonsEmpty}</Txt>
      )}
    </View>
  );
}
