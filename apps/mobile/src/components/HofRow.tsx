// 명예의 전당 · 구단주 '내 선수'가 함께 쓰는 은퇴 선수 한 줄(웹 HofRow.svelte) — 순위 · 이름 · 기록 요약 · 오른쪽 값.
// 누르는 버튼은 부르는 쪽이 감싼다(<Press>). 웹 .hof-row(위 구분선 · 1~3위 메달 빛)도 이 줄이 그린다.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSnapshot } from 'valtio';
import type { PublicHofEntry } from '@offside/contracts';
import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
import { posLabel, type DetailPos, type POS } from '@offside/game/data';
import { titleById } from '@offside/game/titles';
import { prefs } from '../store';
import { alpha } from '../theme/colors';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Pill } from '../ui/bits';
import { ClubMark } from '../ui/ClubBadge';
import { Txt } from '../ui/Txt';
import { MEDAL_GLOW, MEDAL_NAMES, RankBadge } from './Laurel';
import { TitleTag } from './TitleTag';

export type RowStats = Pick<
  PublicHofEntry,
  'apps' | 'goals' | 'assists' | 'trophies' | 'awards' | 'caps' | 'peak' | 'ballon' | 'value'
> & {
  score: number;
};

export interface HofRowProps {
  /** 0부터. 0~2는 금·은·동 월계관. */
  rank: number;
  name: string;
  pos: keyof typeof POS;
  /** T-10-091 세부 포지션(시즌 1부터 만든 선수). */
  dpos?: DetailPos | null | undefined;
  tag?: string | null | undefined;
  t: RowStats;
  titleId: string | null | undefined;
  /** 오른쪽에 크게 보일 값. 기본은 레전드 점수. 은퇴 가치(T-10-100)는 '1,115억'처럼 글자로. */
  value?: number | string;
  unit?: string;
  /** 오른쪽 값이 레전드 점수가 아니면 요약 줄에 레전드 점수를 덧붙인다. */
  showScore?: boolean;
  /** 마지막 소속(T-10-064) — 이름 앞에 엠블럼을 붙인다. */
  club?: string | null | undefined;
  /** T-10-066 마지막 소속 클럽 id. 옛 기록엔 없어 이름으로 찾는다. */
  clubId?: string | null | undefined;
  /** T-10-076 영구결번 등번호. */
  rn?: number | null | undefined;
  /** T-10-096 국적 코드 — 없는 예전 커리어는 대한민국으로 표시한다. */
  nation?: string | null | undefined;
  /** 국적을 모르는 옛 로컬 기록에는 국기를 표시하지 않는다. */
  showNation?: boolean;
  /** T-10-125 기록 요약이 칸보다 길면 말줄임 대신 홈 전광판처럼 오른쪽에서 왼쪽으로 흘린다. */
  flow?: boolean;
  /** 모바일 기록실 줄(웹 .card[data-hof] .hof-row) — 순위 칸 34px, 좌우 여백 2px. */
  compact?: boolean;
  /** 맨 위 줄이면 위 구분선을 뺀다(웹 .hof-row:first-child). 기본은 rank가 0일 때. */
  plain?: boolean;
  showPosition?: boolean;
  first?: boolean;
}

// 흐를 때 두 벌을 이어 붙여 -50%까지 민다(HomeTicker와 같은 방식). 한 벌 = 글 + 뒤 여백(FLOW_GAP).
const FLOW_SPEED = 28; // px/초
const FLOW_GAP = 32;

/** 기록 요약 한 줄 — flow면 칸보다 길 때 흐른다(누르고 있을 때 멈추는 건 앱에선 뺀다). */
function StatsLine({ text, flow }: { text: string; flow: boolean }) {
  const { motionOK } = useSnapshot(prefs);
  const [boxW, setBoxW] = useState(0);
  const [copyW, setCopyW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const flowing = flow && motionOK && boxW > 0 && copyW - FLOW_GAP > boxW + 1;
  useEffect(() => {
    x.setValue(0);
    if (!flowing) return;
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: -copyW,
        duration: (copyW / FLOW_SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    // 첫 글자를 읽을 틈을 두고 출발한다.
    const t = setTimeout(() => loop.start(), 1200);
    return () => {
      clearTimeout(t);
      loop.stop();
      x.setValue(0);
    };
  }, [flowing, copyW, x]);

  // 흐르지 않는 줄: 넘치면 말줄임.
  if (!flow || !motionOK)
    return (
      <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75) }}>
        {text}
      </Txt>
    );
  const line = {
    fontSize: rem(0.75),
    lineHeight: rem(0.75) * 1.5,
    paddingRight: FLOW_GAP,
  };
  return (
    <View
      style={{ overflow: 'hidden' }}
      onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={text}
    >
      {/* 한 벌의 글 폭을 재려고 넉넉히 넓은 줄에 그린다. */}
      <Animated.View
        style={{ flexDirection: 'row', width: 4000, transform: [{ translateX: x }] }}
        accessibilityElementsHidden
      >
        <Txt
          tone="muted"
          numberOfLines={1}
          onLayout={(e) => setCopyW(e.nativeEvent.layout.width)}
          style={line}
        >
          {text}
        </Txt>
        {flowing ? (
          <Txt tone="muted" numberOfLines={1} style={line}>
            {text}
          </Txt>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** 오른쪽 큰 값. 글자 값('1,115억 3천만')은 큰 단위 아래에 작은 단위를 한 줄 더 — 이름 줄이 덜 밀린다. */
function Value({ value, unit }: { value: number | string; unit: string }) {
  const c = useColors();
  const [head, sub] = typeof value === 'string' ? value.split(' ') : [];
  const small = (s: string) => (
    <Txt
      style={{
        fontSize: rem(0.75),
        lineHeight: rem(0.75) * 1.4,
        fontWeight: '600',
        color: c.muted,
        marginLeft: 2,
      }}
    >
      {s}
    </Txt>
  );
  if (typeof value === 'string')
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <Txt
          num
          numberOfLines={1}
          style={{ fontSize: rem(1.0625), lineHeight: rem(1.0625) * 1.15, textAlign: 'right' }}
        >
          {sub ? head : value}
        </Txt>
        {sub ? (
          <Txt numberOfLines={1} style={{ textAlign: 'right' }}>
            {small(`${sub}${unit}`)}
          </Txt>
        ) : unit ? (
          small(unit)
        ) : null}
      </View>
    );
  return (
    <Txt
      num
      numberOfLines={1}
      style={{ fontSize: rem(1.375), lineHeight: rem(1.375) * 1.2, textAlign: 'right' }}
    >
      {value}
      {unit ? small(unit) : null}
    </Txt>
  );
}

/**
 * 순위 줄의 틀(웹 .hof-row) — 순위 칸 · 위 구분선 · 1~3위 옅은 메달 빛. 안쪽(children)은 이름·값 같은 줄 내용.
 * rank는 0부터. 라이브 랭킹(팀)도 같은 틀을 쓴다.
 */
export function RowFrame({
  rank,
  compact = false,
  first,
  plain = false,
  children,
}: {
  rank: number;
  compact?: boolean;
  first?: boolean | undefined;
  plain?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  const medal = plain ? undefined : MEDAL_NAMES[rank];
  const noTop = first ?? rank === 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: compact ? 8 : 10,
        paddingVertical: 10,
        paddingHorizontal: compact ? 2 : 0,
        borderTopWidth: noTop ? 0 : 1,
        borderTopColor: c.line,
        borderRadius: medal ? 10 : 0,
      }}
    >
      {medal ? (
        // 1~3위 옅은 메달 빛(왼쪽에서 70%까지 옅어진다).
        <LinearGradient
          pointerEvents="none"
          colors={[
            alpha(MEDAL_GLOW[medal], 0.12),
            alpha(MEDAL_GLOW[medal], 0),
            alpha(MEDAL_GLOW[medal], 0),
          ]}
          locations={[0, 0.7, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 10 }}
        />
      ) : null}
      {plain ? (
        <Txt num tone="muted" center style={{ width: 24, fontSize: 15 }}>
          {rank + 1}
        </Txt>
      ) : (
        <RankBadge rank={rank + 1} width={compact ? 34 : 40} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

export function HofRow({
  rank,
  name,
  pos,
  dpos = null,
  tag = null,
  t,
  titleId,
  value = t.score,
  unit = '',
  showScore = false,
  club = null,
  clubId = null,
  rn = null,
  nation = null,
  showNation = true,
  flow = false,
  compact = false,
  first,
  plain = false,
  showPosition = true,
}: HofRowProps) {
  const c = useColors();
  const country = showNation
    ? (NATION_BY_CODE.get(nation ?? DEFAULT_NATION) ?? NATION_BY_CODE.get(DEFAULT_NATION))
    : undefined;
  const tt = titleById(titleId);
  const stats = useMemo(
    () =>
      `${t.apps}경기 ${t.goals}골 ${t.assists}도움 · 트로피 ${t.trophies} · 최고 OVR ${t.peak}${t.ballon ? ` · 발롱도르 ${t.ballon}회` : ''}${showScore ? ` · 레전드 ${t.score}` : ''}`,
    [t, showScore],
  );
  return (
    <RowFrame rank={rank} compact={compact} first={first} plain={plain}>
      {/* 두 줄: 윗줄은 이름·포지션·칭호와 오른쪽 값, 아랫줄 기록 요약은 값 밑까지 넓게 쓰고 넘치면 말줄임(T-10-105). */}
      <View style={{ gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10 }}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 5,
              rowGap: 3,
            }}
          >
            <View
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
                plain ? { width: '100%' } : { flexShrink: 1 },
              ]}
            >
              <ClubMark name={club} id={clubId} size={18} />
              {country ? (
                <Txt
                  accessibilityRole="image"
                  accessibilityLabel={country.ko}
                  testID={`hof-nation-${country.code}`}
                  style={{ fontSize: rem(1) }}
                >
                  {flagOf(country.code)}
                </Txt>
              ) : null}
              <Txt bold numberOfLines={plain ? 1 : undefined} style={{ flexShrink: 1 }}>
                {name}
              </Txt>
            </View>
            {showPosition ? (
              <Txt tone="muted" style={{ fontSize: 12 }}>
                {posLabel({ pos, dpos })}
              </Txt>
            ) : null}
            {rn != null ? (
              <View
                accessibilityLabel={`영구결번 ${rn}번`}
                testID="rn-chip"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 999,
                  paddingVertical: 2,
                  paddingHorizontal: 9,
                  backgroundColor: c.surface2,
                  borderWidth: 1,
                  borderColor: c.accent,
                }}
              >
                <Txt style={{ fontSize: rem(0.75), fontWeight: '700', color: c.muted }}>
                  {`👑 영결 ${rn}`}
                </Txt>
              </View>
            ) : null}
            {tag ? <Pill>{tag}</Pill> : null}
            {tt ? <TitleTag name={tt.name} rarity={tt.rarity} /> : null}
          </View>
          <Value value={value} unit={unit} />
        </View>
        {plain ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 3 }}>
            {[
              `${t.apps.toLocaleString('ko-KR')}경기`,
              `${t.goals.toLocaleString('ko-KR')}골`,
              `${t.assists.toLocaleString('ko-KR')}도움`,
            ].map((text) => (
              <Txt key={text} tone="muted" style={{ fontSize: 12 }}>
                {text}
              </Txt>
            ))}
          </View>
        ) : (
          <StatsLine text={stats} flow={flow} />
        )}
      </View>
    </RowFrame>
  );
}
