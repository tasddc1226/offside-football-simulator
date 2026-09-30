// T-10-005 명예의 전당(웹 HallOfFame.svelte): 모든 유저의 은퇴 선수(서버). 행을 누르면 상세로. 이 기기에서 은퇴한 선수에는
// '내 선수' 표시를 단다. 홈에서는 레전드 점수 TOP 3만 보여 주고, '전체 보기'(full)에서는 순위 유형(득점·도움·발롱도르…)을
// 골라 10명씩 페이지로 나눠 보여 준다. score가 아닌 유형은 그 기록이 0인 선수를 뺀다(서버와 같은 규칙).
// T-10-090 전체 보기는 '전체 / 시즌 1'을 고른다. 시즌 순위엔 개막 뒤 새로 만든 선수만 오른다(프리시즌 선수 제외).
// T-11-018 포지션별 순위 — 레전드 점수 상위권을 공격수가 채우므로 포지션 안에서도 겨루게 한다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { CareerPos, HofSort, PublicHofEntry } from '@offside/contracts';
import { POS_GROUPS, POS_LABEL } from '@offside/contracts/positions';
import { SERVICE_SEASONS, serviceSeason } from '@offside/contracts/service-seasons';
import { kstMonthDayHour } from '@offside/app-core/boardText';
import { anonName, fmtValue, iGa } from '@offside/app-core/format';
import { getHof } from '@offside/app-core/api/client';
import { loadHOF } from '@offside/game/season';
import { openHof } from '../game/nav';
import { openPublicLegend } from '../game/host';
import { Seg, SortChips, TabOpt, TextBox } from '../screens/board/parts';
import { appState } from '../store';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Btn } from '../ui/Btn';
import { Card } from '../ui/Card';
import { Press } from '../ui/Press';
import { scrollTo } from '../ui/scroll';
import { Txt } from '../ui/Txt';
import { HofRow, type RowStats } from './HofRow';

const TOP = 3;
const PER_PAGE = 10;
// T-10-101 새로 생긴 순위 유형에 'NEW'를 이때까지 단다.
const NEW_UNTIL: Partial<Record<HofSort, string>> = { value: '2026-10-14T00:00:00+09:00' };
const isNew = (k: HofSort) => {
  const until = NEW_UNTIL[k];
  return !!until && Date.now() < Date.parse(until);
};
/** 아직 개막 전인 시즌인지(ISO 문자열 비교). */
const notOpen = (s: { startsAt: string }) => new Date().toISOString() < s.startsAt;

const SORTS: Record<
  HofSort,
  { label: string; unit: string; get: (s: RowStats) => number | string }
> = {
  score: { label: '레전드 점수', unit: '', get: (s) => s.score },
  // T-10-100 은퇴 가치(만 원) — 조·억·천만으로 적는다.
  value: { label: '은퇴 가치', unit: '', get: (s) => fmtValue(s.value ?? 0) },
  goals: { label: '득점', unit: '골', get: (s) => s.goals },
  assists: { label: '도움', unit: '도움', get: (s) => s.assists },
  ga: { label: '공격포인트', unit: 'P', get: (s) => s.goals + s.assists },
  apps: { label: '출전', unit: '경기', get: (s) => s.apps },
  trophies: { label: '트로피', unit: '개', get: (s) => s.trophies },
  awards: { label: '개인상', unit: '회', get: (s) => s.awards },
  ballon: { label: '발롱도르', unit: '회', get: (s) => s.ballon },
  caps: { label: 'A매치', unit: '경기', get: (s) => s.caps },
  peak: { label: '최고 OVR', unit: '', get: (s) => s.peak },
};
const SORT_KEYS = Object.keys(SORTS) as HofSort[];

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2.4} />
      <Path d="m20 20-4-4" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function HallOfFame({ full = false }: { full?: boolean }) {
  const c = useColors();
  const snap = useSnapshot(appState);
  // 전체 보기의 페이지·유형은 appState에 둬 선수 상세에서 돌아와도 그대로다.
  const page = full ? snap.hof.page : 1;
  const sort: HofSort = full ? snap.hof.sort : 'score';
  const by = SORTS[sort];
  const season = full ? snap.hof.season : null;
  const q = full ? snap.hof.q : '';
  const pos = full ? snap.hof.pos : null;
  const ss = season === null ? undefined : serviceSeason(season);
  /** 고른 시즌이 아직 개막 전이면 그 시즌(목록 대신 개막 안내). */
  const upcoming = ss && notOpen(ss) ? ss : undefined;
  /** 문구 앞에 붙는 시즌·포지션 이름('시즌 1 수비수 '). 둘 다 전체면 빈 문자열. */
  const scope = `${ss ? `${ss.name} ` : ''}${pos ? `${POS_LABEL[pos]} ` : ''}`;
  const [all, setAll] = useState<PublicHofEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);

  function pickSeason(id: number | null) {
    appState.hof = { ...appState.hof, season: id, page: 1 };
  }
  function pickPos(p: CareerPos | null) {
    appState.hof = { ...appState.hof, pos: p, page: 1 };
  }
  function pickSort(s: HofSort) {
    appState.hof = { ...appState.hof, sort: s, page: 1 };
  }

  // 타자를 멈추고 0.3초 뒤에 찾는다(글자마다 서버를 부르지 않게).
  const [draft, setDraft] = useState(appState.hof.q);
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(typing.current), []);
  function onSearch(text: string) {
    setDraft(text);
    clearTimeout(typing.current);
    typing.current = setTimeout(() => {
      const next = text.trim();
      if (next !== appState.hof.q) appState.hof = { ...appState.hof, q: next, page: 1 };
    }, 300);
  }
  // T-10-105 검색 칸은 돋보기를 눌러 연다(검색어가 남아 있으면 열린 채로). 닫으면 검색도 푼다.
  const [searching, setSearching] = useState(!!appState.hof.q);
  function toggleSearch() {
    const next = !searching;
    setSearching(next);
    if (!next && draft) onSearch('');
  }

  function goPage(p: number) {
    appState.hof.page = p;
    scrollTo(0);
  }

  useEffect(() => {
    setAll(null);
    setFailed(false);
    if (upcoming) return;
    let live = true; // 더 늦게 고른 페이지·유형·시즌·검색어·포지션의 응답만 쓴다.
    void getHof(full ? PER_PAGE : TOP, page, sort, season, q, pos).then((r) => {
      if (!live) return;
      if (r.ok) {
        setAll(r.data.entries);
        setTotal(r.data.total ?? r.data.entries.length);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [full, page, sort, season, q, pos, upcoming]);

  const myIds = useMemo(() => new Set(loadHOF().flatMap((h) => (h.id ? [h.id] : []))), []);
  const offset = (page - 1) * PER_PAGE;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const emptyText = q
    ? `'${q}'${iGa(q)} 들어간 이름의 ${scope}선수가 없습니다.`
    : sort === 'score'
      ? `아직 ${scope}은퇴 선수가 없습니다. ${scope}첫 번째 레전드가 되어보세요.`
      : `아직 ${by.label} 기록이 있는 ${scope}은퇴 선수가 없습니다.`;

  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {text}
    </Txt>
  );

  return (
    // 모바일 기록실 전체 보기는 카드 여백을 줄인다(웹 .card[data-hof='full']).
    <Card gap={0} style={full ? { paddingVertical: 16, paddingHorizontal: 12 } : undefined}>
      <View
        testID={full ? 'hof-full' : 'hof-home'}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt v="eyebrow">Legends</Txt>
          <Txt v={full ? 'h1' : 'h2'} accessibilityRole="header" style={{ marginBottom: 8 }}>
            명예의 전당
          </Txt>
        </View>
        {!full && all?.length ? (
          <Btn sm testID="hof-all" onPress={openHof}>
            전체 보기
          </Btn>
        ) : full && !upcoming ? (
          <Press
            testID="hof-search"
            accessibilityLabel="선수 이름 검색"
            accessibilityState={{ expanded: searching }}
            onPress={toggleSearch}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: searching ? c.ink : c.line,
              backgroundColor: searching ? c.ink : c.surface2,
            }}
          >
            <SearchIcon color={searching ? c.surface : c.ink} />
          </Press>
        ) : null}
      </View>
      {full && searching && !upcoming ? (
        <TextBox
          testID="hof-search-input"
          placeholder="선수 이름 검색"
          accessibilityLabel="선수 이름 검색"
          maxLength={20}
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
          clearButtonMode="while-editing"
          value={draft}
          onChangeText={onSearch}
          style={{ marginBottom: 8 }}
        />
      ) : null}
      {full ? (
        <>
          <Seg cols={2} label="시즌" style={{ marginTop: 4, marginBottom: 6 }}>
            <TabOpt
              title="전체"
              selected={season === null}
              testID="hof-season-all"
              onPress={() => pickSeason(null)}
            />
            {SERVICE_SEASONS.map((s) => (
              <TabOpt
                key={s.id}
                title={s.name}
                selected={season === s.id}
                testID={`hof-season-${s.id}`}
                onPress={() => pickSeason(s.id)}
              >
                {notOpen(s) ? (
                  // T-10-103 개막 전 시즌 버튼에 'Coming soon' — 버튼 높이는 그대로, 오른쪽 위 테두리에 걸친다.
                  <View
                    testID="hof-soon"
                    style={{
                      position: 'absolute',
                      top: -9,
                      right: 10,
                      paddingVertical: 2,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: c.accent,
                    }}
                  >
                    <Txt
                      style={{
                        fontSize: rem(0.625),
                        lineHeight: rem(0.625) * 1.4,
                        fontWeight: '800',
                        letterSpacing: 0.06 * rem(0.625),
                        textTransform: 'uppercase',
                        color: c.accentInk,
                      }}
                    >
                      Coming soon
                    </Txt>
                  </View>
                ) : null}
              </TabOpt>
            ))}
          </Seg>
          {!upcoming ? (
            <Seg cols={5} gap={6} label="포지션" style={{ marginBottom: 6 }}>
              <TabOpt
                tight
                title="전체"
                selected={pos === null}
                testID="hof-pos-all"
                onPress={() => pickPos(null)}
              />
              {POS_GROUPS.map((k) => (
                <TabOpt
                  key={k}
                  tight
                  title={POS_LABEL[k]}
                  selected={pos === k}
                  testID={`hof-pos-${k}`}
                  onPress={() => pickPos(k)}
                />
              ))}
            </Seg>
          ) : null}
          {!upcoming ? (
            <SortChips
              label="순위 유형"
              testIDPrefix="hof-sort"
              value={sort}
              onPick={(k) => pickSort(k as HofSort)}
              items={SORT_KEYS.map((k) => ({ key: k, label: SORTS[k].label, isNew: isNew(k) }))}
            />
          ) : null}
        </>
      ) : null}

      {upcoming ? (
        <View testID="hof-upcoming" style={{ paddingVertical: 8, gap: 4 }}>
          <Txt bold style={{ fontSize: rem(0.875) }}>
            {`${upcoming.name}은 ${kstMonthDayHour(upcoming.startsAt)}(한국 시각)에 개막해요.`}
          </Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
            개막 뒤 새로 만든 선수가 은퇴하면 여기에 올라요. 지금(프리시즌) 만든 선수는 전체 명예의
            전당에 남아요.
          </Txt>
        </View>
      ) : all === null && !failed ? (
        <Txt
          tone="muted"
          accessibilityLiveRegion="polite"
          style={{ fontSize: rem(0.875), paddingVertical: 8 }}
        >
          불러오는 중…
        </Txt>
      ) : failed ? (
        empty('명예의 전당을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      ) : all && all.length ? (
        <>
          {full ? (
            <Txt tone="muted" style={{ fontSize: rem(0.75), marginBottom: 6 }}>
              {`${scope && `${scope}· `}${q ? `'${q}' 검색 ` : ''}${sort === 'score' ? '은퇴 선수' : `${by.label} 기록이 있는 선수`} ${total}명 · ${by.label} 순`}
            </Txt>
          ) : null}
          {all.map((h, i) => {
            const t = { ...h, score: h.legendScore };
            return (
              <Press
                key={h.id}
                scale={0.985}
                testID={`hof-row-${h.id}`}
                onPress={() => void openPublicLegend(h)}
              >
                <HofRow
                  rank={h.rank ? h.rank - 1 : offset + i}
                  name={h.name ?? anonName(h.pos, h.number)}
                  pos={h.pos}
                  dpos={h.dpos}
                  nation={h.nation}
                  club={h.lastClub}
                  clubId={h.lastClubId}
                  rn={h.retiredNumber?.number}
                  tag={myIds.has(h.id) ? '내 선수' : null}
                  t={t}
                  titleId={h.title}
                  value={by.get(t)}
                  unit={by.unit}
                  showScore={sort !== 'score'}
                  flow={!full}
                  compact
                  first={i === 0}
                />
              </Press>
            );
          })}
          {full && pages > 1 ? (
            <View
              accessibilityLabel="명예의 전당 페이지"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: c.line,
              }}
            >
              <Btn sm testID="hof-page-prev" disabled={page <= 1} onPress={() => goPage(page - 1)}>
                ← 이전
              </Btn>
              <Txt num accessibilityLiveRegion="polite" style={{ fontWeight: '700' }}>
                {`${page} / ${pages}`}
              </Txt>
              <Btn
                sm
                testID="hof-page-next"
                disabled={page >= pages}
                onPress={() => goPage(page + 1)}
              >
                다음 →
              </Btn>
            </View>
          ) : null}
        </>
      ) : (
        empty(emptyText)
      )}
    </Card>
  );
}
