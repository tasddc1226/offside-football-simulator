// T-10-027 서버 최초 기록(웹 firsts/Firsts.svelte) — 모든 플레이어를 통틀어 처음 세운 기록. 로그인 없이 누구나 본다.
// 최근 기록 탭은 날짜별 연대기, 분류 탭은 규칙 전체(아직 아무도 못 세운 기록 포함)를 보여 준다. 끝없는 단계는
// 누가 넘을 때마다 다음 목표가 열린다. 서버 기록 탭은 더 큰 기록이 나오면 주인이 바뀌는 최다·최고 기록(T-10-056).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { FirstsResponse, ServerFirst } from '@offside/contracts';
import {
  displaySeasonAt,
  openTeamSeasons,
  teamSeasonName,
} from '@offside/contracts/service-seasons';
import { getFirsts } from '@offside/app-core/api/client';
import { kstParts } from '@offside/app-core/boardText';
import {
  FIRSTS_TABS,
  achievedList,
  byDay,
  holderLabel,
  type FirstsTab,
} from '@offside/app-core/firsts';
import { localCareerNames } from '@offside/game/season';
import { goHome } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { BackBar } from '../../ui/ActionBar';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/bits';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { Seg, SortChips, TabOpt } from '../board/parts';

type Holder = NonNullable<ServerFirst['holder']>;

/** 기록 한 줄: 위(이름 · 오른쪽 값) + 아래(누가 · 오른쪽 날짜). */
function FirstRow({
  testID,
  first,
  locked,
  label,
  topRight,
  who,
  bottomRight,
}: {
  testID: string;
  first: boolean;
  locked?: boolean;
  label: string;
  topRight?: ReactNode;
  who: ReactNode;
  bottomRight?: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={{
        gap: 2,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Txt
          bold={!locked}
          tone={locked ? 'muted' : 'ink'}
          style={{ flex: 1, fontSize: rem(0.9375), fontWeight: locked ? '600' : '700' }}
        >
          {label}
        </Txt>
        {topRight}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>{who}</View>
        {bottomRight}
      </View>
    </View>
  );
}

const TimeText = ({ children }: { children: string }) => (
  <Txt tone="muted" num={400} style={{ fontSize: rem(0.8125) }}>
    {children}
  </Txt>
);
const WhoText = ({ children }: { children: string }) => (
  <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
    {children}
  </Txt>
);

export default function Firsts() {
  const c = useColors();
  const [data, setData] = useState<FirstsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<FirstsTab>('recent');
  // T-11-029 기록은 시즌마다 따로 — 개막한 시즌이 둘 이상이면 시즌 탭을 보인다(기본은 지금 시즌).
  const now = useMemo(() => new Date().toISOString(), []);
  const seasons = useMemo(() => openTeamSeasons(now), [now]);
  const [picked, setPicked] = useState<number | null>(null);
  const season = picked ?? displaySeasonAt(now);
  useEffect(() => {
    setData(null);
    setFailed(false);
    let live = true; // 더 늦게 고른 시즌의 응답만 쓴다.
    void getFirsts(season).then((r) => {
      if (!live) return;
      if (r.ok) setData(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season]);

  // 내 선수: 진행 중인 커리어 + 이 기기의 은퇴 선수. 서버엔 이름 공개를 끈 선수의 이름이 없으니 여기서 채운다.
  const mine = useMemo<ReadonlyMap<string, string>>(() => {
    const G = appState.G;
    return new Map([...localCareerNames(), ...(G ? [[G.cid, G.name] as const] : [])]);
  }, []);

  const total = data?.items.length ?? 0;
  const achieved = data ? achievedList(data.items) : [];
  const done = achieved.length;
  const days = byDay(achieved);
  const list = data ? data.items.filter((x) => x.cat === tab) : [];

  const who = (h: Holder) => {
    const w = holderLabel(h, mine);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <WhoText>{w.name}</WhoText>
        {w.mine ? <Pill tone="good">내 선수</Pill> : null}
      </View>
    );
  };
  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {text}
    </Txt>
  );

  return (
    <Screen footer={<BackBar testID="home" fallback={goHome} />}>
      <Topbar />
      <Card gap={0}>
        <View testID="firsts">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <View>
              <Txt v="eyebrow">Server firsts</Txt>
              <Txt v="h1" accessibilityRole="header" style={{ marginBottom: 4 }}>
                서버 최초 업적
              </Txt>
            </View>
            {data ? (
              <Txt
                num
                testID="firsts-count"
                style={{ fontSize: rem(1.375), lineHeight: rem(1.375) * 1.3, color: c.accentText }}
              >
                {`${done}/${total}`}
              </Txt>
            ) : null}
          </View>
          <Txt tone="muted" style={{ fontSize: rem(0.8125), marginBottom: 10 }}>
            {`${
              tab === 'records'
                ? '모든 플레이어 중 가장 높은 기록이에요. 더 큰 기록이 나오면 주인이 바뀌어요.'
                : '모든 플레이어를 통틀어 가장 먼저 세운 기록만 남아요.'
            } 이름은 명예의 전당에 이름을 공개한 선수만 보여요.`}
          </Txt>
        </View>
        {seasons.length > 1 ? (
          <Seg cols={Math.min(seasons.length, 3)} label="시즌" style={{ marginBottom: 10 }}>
            {seasons.map((id) => (
              <TabOpt
                key={id}
                title={teamSeasonName(id)}
                selected={season === id}
                testID={`firsts-season-${id}`}
                onPress={() => setPicked(id)}
              />
            ))}
          </Seg>
        ) : null}
        <SortChips
          label="기록 분류"
          testIDPrefix="firsts-tab"
          value={tab}
          onPick={(k) => setTab(k as FirstsTab)}
          items={FIRSTS_TABS.map((t) => ({ key: t.id, label: t.label }))}
        />

        {failed ? (
          empty('서버 최초 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
        ) : !data ? (
          <Txt
            tone="muted"
            accessibilityLiveRegion="polite"
            style={{ fontSize: rem(0.875), paddingVertical: 8 }}
          >
            불러오는 중…
          </Txt>
        ) : tab === 'recent' ? (
          days.length ? (
            days.map((d) => (
              <View key={d.day}>
                <Txt
                  num
                  accessibilityRole="header"
                  tone="muted"
                  style={{ fontSize: rem(0.8125), marginTop: 14, marginBottom: 2 }}
                >
                  {d.day}
                </Txt>
                {d.items.map((x, i) => (
                  <FirstRow
                    key={x.id}
                    testID={`first-${x.id}`}
                    first={i === 0}
                    label={x.label}
                    topRight={<TimeText>{kstParts(x.achievedAt).time}</TimeText>}
                    who={who(x.holder)}
                  />
                ))}
              </View>
            ))
          ) : (
            empty('아직 세워진 서버 최초 기록이 없어요. 첫 주인공이 되어 보세요!')
          )
        ) : tab === 'records' ? (
          <View>
            {data.records.map((r, i) => (
              <FirstRow
                key={r.id}
                testID={`record-${r.id}`}
                first={i === 0}
                locked={!r.holder}
                label={r.label}
                topRight={
                  r.holder && r.value !== null && r.achievedAt ? (
                    <Txt num style={{ fontSize: rem(0.9375), fontWeight: '800' }}>
                      {`${r.value.toLocaleString('ko-KR')}${r.unit}`}
                    </Txt>
                  ) : undefined
                }
                who={
                  r.holder && r.value !== null && r.achievedAt ? (
                    who(r.holder)
                  ) : (
                    <WhoText>아직 기록 없음</WhoText>
                  )
                }
                bottomRight={
                  r.holder && r.value !== null && r.achievedAt ? (
                    <TimeText>{kstParts(r.achievedAt).day}</TimeText>
                  ) : undefined
                }
              />
            ))}
          </View>
        ) : (
          <View>
            {list.map((x, i) => (
              <FirstRow
                key={x.id}
                testID={`first-${x.id}`}
                first={i === 0}
                locked={!x.holder}
                label={x.label}
                topRight={
                  x.holder && x.achievedAt ? (
                    <TimeText>{kstParts(x.achievedAt).day}</TimeText>
                  ) : undefined
                }
                who={x.holder && x.achievedAt ? who(x.holder) : <WhoText>미달성</WhoText>}
              />
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}
