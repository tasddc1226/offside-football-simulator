import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSnapshot } from 'valtio';
import { fetchOwnerArchive, type OwnerArchiveResponse } from '@offside/app-core/api/ownerProfile';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { honorViews } from '@offside/app-core/seasonRecap';
import Svg, { Path } from 'react-native-svg';
import { titleLabel, titleIconPath } from '@offside/app-core/ownerTitle';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { Screen, Press, Txt, Btn } from '../../ui';
import { registerScroll, noteScrollY, noteViewH } from '../../ui/scroll';
import { appState, prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { HonorEmblem } from '../../components/HonorEmblem';
import { CupHonors } from '../../components/CupHonors';
import { OwnerHall } from './OwnerHall';
import { OwnerArchive } from './OwnerArchive';
import { LockerArt } from './LockerArt';

const panels = ['records', 'titles', 'trophies'] as const;
// Same material palette as the web room; the record sheet follows the user's theme.
const room = {
  bg: '#102219',
  wall: '#14281e',
  gold: '#d5bd7d',
  ink: '#ede9d8',
  muted: '#b6c3b2',
  line: '#52674e',
};

function Wall({
  index,
  position,
  width,
  height,
  data,
  awards,
  active,
}: {
  index: number;
  position: SharedValue<number>;
  width: number;
  height: number;
  data: OwnerArchiveResponse | null;
  awards: number;
  active: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const distance = index - position.value;
    const angle = distance * 52;
    return {
      opacity: Math.max(0.3, 1 - Math.abs(distance) * 0.38),
      zIndex: 3 - Math.round(Math.abs(distance)),
      transform: [
        { perspective: 850 },
        { translateX: Math.sin((angle * Math.PI) / 180) * width * 1.1 },
        { scale: Math.max(0.62, 1 - Math.abs(distance) * 0.2) },
        { rotateY: `${-angle}deg` },
      ],
    };
  });
  const season = Math.max(0, ...(data?.owner.seasons.map((s) => s.season) ?? []));
  const title = data?.owner.title ?? null;
  return (
    <Reanimated.View
      pointerEvents="none"
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[{ position: 'absolute', width, height, top: 16, alignSelf: 'center' }, style]}
    >
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LockerArt zone={index} season={season} title={title} awards={awards} />
      </View>
      {index === 0 ? (
        <View style={styles.seasons}>
          {[0, season].map((s, i) => (
            <Txt key={i} style={styles.plate} numberOfLines={1}>
              {teamSeasonLabel(s)}
            </Txt>
          ))}
        </View>
      ) : null}
      {index === 1 ? (
        <>
          <View style={styles.name}>
            <Txt bold center numberOfLines={1} style={{ color: room.ink, fontSize: 13 }}>
              {data?.owner.nickname ?? L.noNickname}
            </Txt>
          </View>
          <View style={styles.tag}>
            {title ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Svg width={16} height={16} viewBox="0 0 16 16">
                  <Path
                    d={
                      titleIconPath(title) ||
                      'M2 2h12v2h2v5h-3v2h-3v2h3v2H3v-2h3v-2H3V9H0V4h2Zm0 3H1v3h1Zm12 0v3h1V5Z'
                    }
                    fill={room.ink}
                  />
                </Svg>
              </View>
            ) : null}
            <Txt bold center style={{ color: room.ink, fontSize: 13, flexShrink: 1 }}>
              {titleLabel(title) ?? L.currentNone}
            </Txt>
          </View>
        </>
      ) : null}
    </Reanimated.View>
  );
}

export default function OwnerHonors() {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(windowWidth, 680));
  const [zone, setZone] = useState(1);
  const [visited, setVisited] = useState({ records: false, titles: true });
  const [data, setData] = useState<OwnerArchiveResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const alive = useRef(false);
  const position = useSharedValue(1);
  const scrollY = useRef(new Animated.Value(0)).current;
  const names = [L.roomSeasons, L.roomOwner, L.roomTrophies];
  const notes = [L.roomSeasonsNote, L.roomOwnerNote, L.roomTrophiesNote];
  const wallHeight = Math.max(220, Math.min(windowHeight * 0.37, 370));
  const wallWidth = Math.min(width * 0.82, (wallHeight * 240) / 290);
  const badges = honorViews(data?.honors ?? []);
  const awards = badges.length + (data?.owner.cupHonors.length ?? 0);
  const load = useCallback(async () => {
    setFailed(false);
    const r = await fetchOwnerArchive();
    if (!alive.current) return;
    if (r.ok) setData(r.data);
    else setFailed(true);
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  const turn = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(2, next));
      setZone(target);
      position.value = motionOK
        ? withTiming(target, { duration: 480, easing: Easing.out(Easing.cubic) })
        : target;
      const panel = panels[target]!;
      if (panel !== 'trophies') {
        setVisited((old) => ({ ...old, [panel]: true }));
        appState.honorsView = panel;
      }
    },
    [motionOK, position],
  );
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .runOnJS(true)
        .onUpdate((e) => {
          if (motionOK)
            position.value = Math.max(-0.15, Math.min(2.15, zone - e.translationX / width));
        })
        .onEnd((e) =>
          turn(zone + (Math.abs(e.translationX) > 45 ? (e.translationX < 0 ? 1 : -1) : 0)),
        )
        .onFinalize((_e, success) => {
          if (!success) turn(zone);
        }),
    [motionOK, position, turn, width, zone],
  );
  return (
    <Screen fixed gap={0} style={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <Animated.ScrollView
        ref={registerScroll}
        testID="owner-honors-screen"
        onLayout={(e) => {
          setWidth(Math.min(e.nativeEvent.layout.width, 680));
          noteViewH(e.nativeEvent.layout.height);
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (e: NativeSyntheticEvent<NativeScrollEvent>) =>
            noteScrollY(e.nativeEvent.contentOffset.y),
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          paddingBottom: 24,
          backgroundColor: room.bg,
        }}
      >
        <Animated.View
          testID="room-scene"
          style={{
            zIndex: 0,
            backgroundColor: room.bg,
            transform: [
              {
                translateY: motionOK
                  ? scrollY.interpolate({ inputRange: [-1, 0, 10000], outputRange: [0, 0, 10000] })
                  : 0,
              },
            ],
          }}
        >
          <View style={styles.heading}>
            <Txt v="h1" accessibilityRole="header" style={{ color: room.ink }}>
              {L.hallTitle}
            </Txt>
            <Txt style={{ color: room.muted, fontSize: 12 }}>
              {data?.owner.team?.name ?? L.roomTitle}
            </Txt>
          </View>
          <GestureDetector gesture={gesture}>
            <View
              testID="locker-stage"
              collapsable={false}
              style={{ height: wallHeight + 70, overflow: 'hidden', backgroundColor: room.wall }}
            >
              <View style={styles.ceiling} pointerEvents="none">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.light} />
                ))}
              </View>
              <View style={styles.floor} pointerEvents="none">
                <Txt center style={{ color: '#74816a', fontSize: 64 }}>
                  ◈
                </Txt>
              </View>
              {panels.map((p, i) => (
                <Wall
                  key={p}
                  index={i}
                  position={position}
                  width={wallWidth}
                  height={wallHeight}
                  data={data}
                  awards={awards}
                  active={zone === i}
                />
              ))}
              <Txt center style={styles.hint}>
                {L.roomHint}
              </Txt>
            </View>
          </GestureDetector>
          <View style={styles.controls}>
            <Press
              testID="room-prev"
              accessibilityLabel={L.roomPrev}
              disabled={zone === 0}
              accessibilityState={{ disabled: zone === 0 }}
              onPress={() => turn(zone - 1)}
              style={[styles.arrow, { opacity: zone === 0 ? 0.25 : 1 }]}
            >
              <Txt style={styles.arrowText}>‹</Txt>
            </Press>
            <View accessibilityLiveRegion="polite" style={{ flex: 1, gap: 4 }}>
              <Txt bold center style={{ color: room.ink, fontSize: 19 }}>
                {names[zone]}
              </Txt>
              <Txt center style={{ color: room.muted, fontSize: 12 }}>
                {notes[zone]}
              </Txt>
            </View>
            <Press
              testID="room-next"
              accessibilityLabel={L.roomNext}
              disabled={zone === 2}
              accessibilityState={{ disabled: zone === 2 }}
              onPress={() => turn(zone + 1)}
              style={[styles.arrow, { opacity: zone === 2 ? 0.25 : 1 }]}
            >
              <Txt style={styles.arrowText}>›</Txt>
            </Press>
          </View>
          <View style={styles.dots}>
            {names.map((name, i) => (
              <Press
                key={i}
                testID={`room-zone-${i}`}
                accessibilityLabel={name}
                accessibilityState={{ selected: zone === i }}
                onPress={() => turn(i)}
                style={styles.dotTarget}
              >
                <View
                  style={{
                    width: zone === i ? 20 : 6,
                    height: 6,
                    borderRadius: 5,
                    backgroundColor: zone === i ? room.gold : room.line,
                  }}
                />
              </Press>
            ))}
          </View>
          {failed ? (
            <View style={{ padding: 16, gap: 8 }}>
              <Txt center style={{ color: room.ink }}>
                {L.archiveError}
              </Txt>
              <Btn onPress={() => void load()}>{L.retry}</Btn>
            </View>
          ) : !data ? (
            <Txt center style={{ color: room.muted, padding: 12 }}>
              {L.roomLoading}
            </Txt>
          ) : null}
        </Animated.View>
        <View
          testID={`room-list-${panels[zone]}`}
          style={{
            zIndex: 1,
            marginHorizontal: 12,
            padding: 16,
            paddingTop: 22,
            minHeight: windowHeight - 100,
            gap: 16,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.bg,
          }}
        >
          {visited.records ? (
            <View style={{ display: zone === 0 ? 'flex' : 'none' }}>
              <OwnerArchive />
            </View>
          ) : null}
          {visited.titles ? (
            <View style={{ display: zone === 1 ? 'flex' : 'none' }}>
              <OwnerHall
                onpick={(title) =>
                  setData((old) => (old ? { ...old, owner: { ...old.owner, title } } : old))
                }
              />
            </View>
          ) : null}
          {zone === 2 ? (
            <View testID="trophy-gallery" style={{ gap: 16 }}>
              {!data ? (
                <Txt tone="muted">{failed ? L.archiveError : L.archiveLoading}</Txt>
              ) : !awards ? (
                <Txt tone="muted">{L.roomEmptyAwards}</Txt>
              ) : (
                <>
                  {badges.length ? (
                    <>
                      <Txt v="h2" accessibilityRole="header">
                        {L.roomBadgeCount} {badges.length}
                      </Txt>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {badges.map((h) => (
                          <View
                            key={`${h.season}-${h.kind}`}
                            style={{
                              width: '47%',
                              flexGrow: 1,
                              alignItems: 'center',
                              gap: 6,
                              padding: 12,
                              borderRadius: 10,
                              backgroundColor: c.surface,
                            }}
                          >
                            <HonorEmblem h={h} size={64} />
                            <Txt bold center>
                              {h.title}
                            </Txt>
                            <Txt tone="muted" center>
                              {teamSeasonLabel(h.season)}
                            </Txt>
                            <Txt tone="muted" center>
                              {h.detail}
                            </Txt>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                  {data.owner.cupHonors.length ? (
                    <>
                      <Txt v="h2" accessibilityRole="header">
                        {L.roomCupCount}
                      </Txt>
                      <CupHonors honors={data.owner.cupHonors} />
                    </>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, gap: 4 },
  ceiling: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#394738',
    borderBottomWidth: 3,
    borderBottomColor: room.gold,
  },
  light: { width: '18%', height: 4, backgroundColor: '#eee7c1' },
  floor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '38%',
    backgroundColor: '#25352d',
    borderTopWidth: 5,
    borderTopColor: '#b59a5e',
    justifyContent: 'center',
  },
  seasons: {
    position: 'absolute',
    top: '16%',
    left: '9%',
    right: '9%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  plate: {
    backgroundColor: '#172b21',
    color: '#e6d296',
    paddingHorizontal: 4,
    fontSize: 10,
    maxWidth: '48%',
  },
  name: {
    position: 'absolute',
    top: '61.3%',
    left: '24%',
    width: '52%',
    height: '8%',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    bottom: '8%',
    alignSelf: 'center',
    maxWidth: '94%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#9c8d58',
    backgroundColor: room.bg,
  },
  hint: { position: 'absolute', bottom: 6, left: 12, right: 12, color: room.muted, fontSize: 11 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  arrow: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: room.line,
    borderRadius: 8,
  },
  arrowText: { color: room.gold, fontSize: 30 },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dotTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
