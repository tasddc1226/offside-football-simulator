// T-11-825 원정 투어(내 구단 화면 '원정 투어' 칸으로 연다, 웹 owner/SquadTour.svelte). 열 때 투어 홈과 내 팀(선수 목록, 1분 메모)만
// 받는다. 사다리 · 제한 · 자동 편성은 app-core/contracts 계산이라 따로 부르지 않는다. 여정 지도 → 편성(상대 분석 · 선발 · 교체 명단 ·
// 전술) → 작전 경기(30분 · 60분 작전 타임) → 결과. 주간 순위는 탭을 열 때만 받는다. 그라운드 · 선수 카드는 팀 화면의 것을 그대로 쓴다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { fetchOwnerTeam, type TeamPlayer } from '@offside/app-core/api/team';
import {
  fetchTour,
  fetchTourRanking,
  orderTourMatch,
  startTourMatch,
} from '@offside/app-core/api/tour';
import type {
  TourMatchView,
  TourRankingResponse,
  TourStage,
  TourStateResponse,
} from '@offside/contracts';
import { FORMATIONS, FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
import { TOUR_TRIES_PER_DAY } from '@offside/contracts/squad-tour';
import { fmtValue } from '@offside/contracts/market-value';
import {
  TOUR_LIVE,
  TOUR_MAIN_STAGES,
  TOUR_TACTICS,
  tourAutoDraft,
  tourBenchOptions,
  tourCells,
  tourChances,
  tourEdge,
  tourOptions,
  tourPicks,
  tourRuleText,
  tourSpan,
  tourStageName,
  tourStageState,
  tourTacticDesc,
  tourTacticName,
  tourTired,
  tourWeekLeft,
  type TourDraft,
  type TourTactic,
} from '@offside/app-core/tour';
import { RADIUS } from '@offside/app-core/design-tokens';
import { marketName } from '@offside/app-core/market';
import { localCareerNames } from '@offside/game/hof-store';
import { tourText as L } from '@offside/app-core/i18n/ko/tour';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Opt, Press, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';
import { PlayerCard, type PlayerCardData } from '../../components/PlayerCard';
import { TeamPitch } from '../../components/TeamPitch';
import { playSfx } from '../../platform/sfx';

type Step = 'map' | 'prep' | 'live' | 'result' | 'rank';

/** 선수 한 명을 그라운드 · 목록 카드 값으로(빈 자리는 팀 화면의 유소년 카드 모양). */
const cellOf = (p: TeamPlayer | undefined, name: string, rating: number): PlayerCardData =>
  p
    ? {
        name,
        rating,
        youth: false,
        peak: p.peak,
        number: p.number,
        legendScore: p.legendScore,
        specials: p.specials,
        daily: p.daily,
        careerId: p.careerId,
        look: p.look,
        nation: p.nation,
        season: p.season,
        enhance: p.enhance,
        locked: p.locked,
      }
    : { name, rating, youth: true };

/** 선수 고르기 · 교체 명단의 작은 카드(팀 화면 카드의 compact · mini판)와 이름. */
function Mini({
  player,
  name,
  rating,
  code,
  note,
  noteTone,
}: {
  player: TeamPlayer;
  name: string;
  rating: number;
  code: DetailPos;
  note?: string | null;
  noteTone?: 'bad' | 'muted';
}) {
  return (
    <View style={{ width: 76, alignItems: 'center', gap: 4 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 64 }}
      >
        <PlayerCard compact mini animate={false} code={code} cell={cellOf(player, name, rating)} />
      </View>
      <Txt v="xs" numberOfLines={1} style={{ maxWidth: 76 }}>
        {name}
      </Txt>
      {note ? (
        <Txt v="xs" tone={noteTone ?? 'muted'} center>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

export function SquadTour({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const [local] = useState(() => localCareerNames());
  const [view, setView] = useState<Step>('map');
  const [tour, setTour] = useState<TourStateResponse | null>(null);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 편성
  const [draftFormation, setDraftFormation] = useState<FormationId | null>(null);
  const [stage, setStage] = useState<TourStage | null>(null);
  const [draft, setDraft] = useState<TourDraft | null>(null);
  const [slotOpen, setSlotOpen] = useState<number | null>(null);
  const [benchOpen, setBenchOpen] = useState(false);

  // 작전 경기
  const [match, setMatch] = useState<TourMatchView | null>(null);
  const [orderTactic, setOrderTactic] = useState<TourTactic>('possession');
  const [subs, setSubs] = useState<{ slot: number; cardId: string }[]>([]);
  const [outSlot, setOutSlot] = useState<number | null>(null);

  // 주간 순위
  const [ranking, setRanking] = useState<TourRankingResponse | null>(null);
  const [rankFailed, setRankFailed] = useState(false);

  const resetOrder = (m: TourMatchView | null) => {
    setOrderTactic(m?.tactic ?? 'possession');
    setSubs([]);
    setOutSlot(null);
  };

  const load = useCallback(async () => {
    setFailed(false);
    const [t, team] = await Promise.all([fetchTour(), fetchOwnerTeam()]);
    if (!t.ok || !team.ok) return setFailed(true);
    setTour(t.data);
    setPlayers(team.data.players);
    if (team.data.team) setDraftFormation((f) => f ?? team.data.team!.formation);
    if (t.data.live) {
      setMatch(t.data.live);
      resetOrder(t.data.live);
      setView('live');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(players.map((p) => [p.careerId, p])), [players]);
  const picks = useMemo(() => tourPicks(players), [players]);
  const pickById = useMemo(() => new Map(picks.map((p) => [p.id, p])), [picks]);
  const nameOf = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    return p ? marketName(p, local) : L.mercName;
  };
  const totalStars = (tour?.stages ?? []).reduce((a, s) => a + s.stars, 0);
  const left = tourWeekLeft(new Date().toISOString());

  function openStage(s: TourStage) {
    if (!tour) return;
    setStage(s);
    setDraft(tourAutoDraft(s, picks, tour.season, draftFormation ?? '4-3-3'));
    setSlotOpen(null);
    setBenchOpen(false);
    setError('');
    setView('prep');
  }
  function setFormation(f: FormationId) {
    if (!tour || !stage || !draft) return;
    setDraftFormation(f);
    setDraft({ ...tourAutoDraft(stage, picks, tour.season, f), tactic: draft.tactic });
    setSlotOpen(null);
  }
  function auto() {
    if (!tour || !stage || !draft) return;
    setDraft({
      ...tourAutoDraft(stage, picks, tour.season, draft.formation),
      tactic: draft.tactic,
    });
    setSlotOpen(null);
  }
  function place(id: string | null) {
    if (!draft || slotOpen === null) return;
    const slotIds = [...draft.slotIds];
    slotIds[slotOpen] = id;
    setDraft({ ...draft, slotIds });
    setSlotOpen(null);
  }
  function toggleBench(id: string) {
    if (!draft) return;
    const has = draft.bench.includes(id);
    if (!has && draft.bench.length >= TOUR_LIVE.bench) return;
    setDraft({ ...draft, bench: has ? draft.bench.filter((x) => x !== id) : [...draft.bench, id] });
  }
  async function depart() {
    if (!stage || !draft || busy) return;
    setBusy(true);
    setError('');
    const r = await startTourMatch({ stage: stage.stage, ...draft });
    setBusy(false);
    if (!r.ok) return setError(r.error.message || L.departFail);
    playSfx('reward');
    setMatch(r.data.match);
    setTour((t) => (t ? { ...t, triesLeft: r.data.triesLeft } : t));
    resetOrder(r.data.match);
    setView('live');
  }

  const cells = useMemo(
    () => (stage && draft ? tourCells(draft, pickById, stage.rules, stage.merc) : []),
    [stage, draft, pickById],
  );
  const pitchCells = cells.map((x) =>
    cellOf(x.id ? byId.get(x.id) : undefined, nameOf(x.id), x.rating),
  );
  const options =
    tour && stage && draft && slotOpen !== null
      ? tourOptions(draft, slotOpen, picks, stage.rules, tour.season)
      : [];
  const benchOptions =
    tour && stage && draft && benchOpen
      ? tourBenchOptions(draft, picks, stage.rules, tour.season)
      : [];

  // 작전 경기
  const liveStage = match ? (tour?.stages.find((s) => s.stage === match.stage) ?? null) : null;
  const liveSlots = match
    ? match.slotIds.map((id, i) => subs.find((s) => s.slot === i)?.cardId ?? id)
    : [];
  const liveCells = match
    ? liveSlots.map((id, i) => {
        const p = id ? byId.get(id) : undefined;
        const fresh = subs.some((s) => s.slot === i);
        const base = tourCells(
          { formation: match.formation, slotIds: liveSlots },
          pickById,
          liveStage?.rules ?? [],
          liveStage?.merc ?? 0,
        )[i]!;
        const t = tourTired(base.rating, fresh ? 100 : (match.stamina[i] ?? 100));
        return { i, id, slot: FORMATIONS[match.formation][i]!, name: nameOf(id), player: p, ...t };
      })
    : [];
  const livePitch = liveCells.map((x) => cellOf(x.player, x.name, Math.round(x.rating)));
  const benchLeft = match ? match.bench.filter((id) => !subs.some((s) => s.cardId === id)) : [];
  const chances = match ? tourChances(match) : [];
  const span = match ? tourSpan(match.done) : { from: 0, to: 30 };
  function pickOut(i: number) {
    if (!match || subs.length >= match.subsLeft || subs.some((s) => s.slot === i)) return;
    setOutSlot((cur) => (cur === i ? null : i));
  }
  function pickIn(cardId: string) {
    if (outSlot === null) return;
    setSubs((cur) => [...cur, { slot: outSlot, cardId }]);
    setOutSlot(null);
  }
  async function sendOrder() {
    if (!match || busy) return;
    setBusy(true);
    setError('');
    const r = await orderTourMatch(match.id, {
      done: match.done,
      ...(orderTactic !== match.tactic ? { tactic: orderTactic } : {}),
      ...(subs.length ? { subs } : {}),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error.message || L.orderFail);
    const next = r.data.match;
    setMatch(next);
    setTour((t) => (t ? { ...t, triesLeft: r.data.triesLeft } : t));
    resetOrder(next);
    if (next.status !== 'live') {
      if (next.status === 'won') playSfx('reward');
      setView('result');
      // 진행 · 순위 · 별이 바뀌었다(지시 요청이 메모를 비웠다).
      const t = await fetchTour();
      if (t.ok) setTour(t.data);
    }
  }
  const goalText = (e: TourMatchView['events'][number]) =>
    e.side === 'away' ? (e.scorerId ? nameOf(e.scorerId) : e.scorer) : L.oppGoal;

  async function openRank() {
    setView('rank');
    setRankFailed(false);
    const r = await fetchTourRanking();
    if (r.ok) setRanking(r.data);
    else setRankFailed(true);
  }
  const nextStage = tour ? (tour.stages.find((s) => s.stage === tour.cleared + 1) ?? null) : null;

  const box = {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  } as const;
  const band = {
    gap: 10,
    padding: 16,
    borderRadius: RADIUS.md,
    backgroundColor: c.pitch,
  } as const;
  const tone = (n: number) =>
    (n > 0 ? 'good' : n < 0 ? 'bad' : 'muted') as 'good' | 'bad' | 'muted';
  const rule = (text: string, key: string) => (
    <View
      key={key}
      style={{
        alignSelf: 'flex-start',
        minHeight: 26,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface2,
      }}
    >
      <Txt v="xs" bold>
        {text}
      </Txt>
    </View>
  );
  const stats = (rows: { label: string; value: string; gold?: boolean; testID?: string }[]) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flex: 1, gap: 2 }}>
          <Txt v="xs" tone="onPitch" style={{ opacity: 0.75 }}>
            {r.label}
          </Txt>
          <Txt
            tone={r.gold ? 'pitchAccent' : 'onPitch'}
            testID={r.testID}
            style={{ fontFamily: DISPLAY[700], fontSize: rem(1.4) }}
          >
            {r.value}
          </Txt>
        </View>
      ))}
    </View>
  );
  const tacticGrid = (
    items: {
      tactic: TourTactic;
      text: string;
      textTone: 'good' | 'bad' | 'muted';
      now?: boolean;
    }[],
    value: TourTactic,
    onPick: (t: TourTactic) => void,
    label: string,
  ) => (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
    >
      {items.map((it) => (
        <View key={it.tactic} style={{ flexBasis: '48%', flexGrow: 1 }}>
          <Opt
            testID={`tour-tactic-${it.tactic}`}
            selected={value === it.tactic}
            accessibilityLabel={`${tourTacticName(it.tactic)}, ${it.text}`}
            onPress={() => onPick(it.tactic)}
            style={{ minHeight: 56 }}
          >
            <Txt bold>
              {it.now ? `${tourTacticName(it.tactic)} · ${L.now}` : tourTacticName(it.tactic)}
            </Txt>
            <Txt v="xs" tone={it.textTone}>
              {it.text}
            </Txt>
          </Opt>
        </View>
      ))}
    </View>
  );

  const header =
    view === 'rank'
      ? L.rankingTitle
      : stage && view === 'prep'
        ? tourStageName(stage.stage)
        : L.title;

  return (
    <PopSheet label={L.title} step={view} testID="squad-tour" onClose={onClose}>
      <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {view === 'prep' || view === 'rank' ? (
            <Btn sm testID="tour-back" accessibilityLabel={L.back} onPress={() => setView('map')}>
              ‹
            </Btn>
          ) : null}
          <Txt v="h2" style={{ flex: 1 }} accessibilityRole="header">
            {header}
          </Txt>
          {view !== 'live' ? (
            <Btn sm testID="tour-close" accessibilityLabel={L.close} onPress={onClose}>
              ✕
            </Btn>
          ) : null}
        </View>

        {failed ? (
          <>
            <Txt tone="bad">{L.loadFail}</Txt>
            <Btn testID="tour-retry" onPress={() => void load()}>
              {L.retry}
            </Btn>
          </>
        ) : !tour ? (
          <Txt tone="muted">{L.loading}</Txt>
        ) : !tour.open ? (
          <Txt tone="muted" testID="tour-closed">
            {L.closedTitle}
          </Txt>
        ) : view === 'map' ? (
          <>
            <View testID="tour-summary" style={band}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Txt v="sm" tone="onPitch" style={{ flex: 1 }}>
                  {L.weekEnds(left)}
                </Txt>
                <Btn sm kind="ghost" testID="tour-rank" onPress={() => void openRank()}>
                  {L.rankingTitle}
                </Btn>
              </View>
              {stats([
                { label: L.score, value: String(tour.score) },
                { label: L.rankingTitle, value: tour.rank ? L.rank({ n: tour.rank }) : L.rankNone },
                {
                  label: L.starsOf({ n: totalStars, max: TOUR_MAIN_STAGES * 3 }),
                  value: `★ ${totalStars}`,
                  gold: true,
                },
              ])}
              <Txt v="sm" tone="onPitch" testID="tour-tries">
                {L.triesLeft({ n: tour.triesLeft, max: TOUR_TRIES_PER_DAY })}
              </Txt>
            </View>
            <Txt v="sm" tone="muted">
              {L.lead}
            </Txt>
            <View testID="tour-map" style={{ gap: 12 }}>
              {tour.stages.map((s) => {
                const state = tourStageState(s, tour.cleared);
                const next = state === 'next';
                return (
                  <View
                    key={s.stage}
                    testID={`tour-stage-${s.stage}`}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        borderWidth: 2,
                        borderColor: state === 'done' ? c.good : next ? c.accentText : c.line,
                        backgroundColor: state === 'done' ? c.good : c.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt
                        accessible={false}
                        style={{
                          fontFamily: DISPLAY[700],
                          fontSize: rem(1.2),
                          color: state === 'done' ? c.surface : next ? c.accentText : c.muted,
                        }}
                      >
                        {state === 'done' ? '✓' : String(s.stage)}
                      </Txt>
                    </View>
                    <View
                      style={[
                        box,
                        {
                          flex: 1,
                          minWidth: 0,
                          gap: 6,
                          padding: 12,
                          borderColor: next ? c.accentText : c.line,
                          opacity: state === 'locked' ? 0.6 : 1,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Txt bold>{tourStageName(s.stage)}</Txt>
                        <Txt
                          accessibilityLabel={L.starsOf({ n: s.stars, max: 3 })}
                          style={{ color: c.warn, letterSpacing: 2 }}
                        >
                          {'★'.repeat(s.stars)}
                          <Txt style={{ color: c.line, letterSpacing: 2 }}>
                            {'★'.repeat(3 - s.stars)}
                          </Txt>
                        </Txt>
                      </View>
                      <Txt v="xs" tone="muted">
                        {`${L.oppOvr({ n: s.opp })} · ${s.formation} · ${tourTacticName(s.tactic)}`}
                      </Txt>
                      {s.rules.map((r, k) => rule(tourRuleText(r), String(k)))}
                      <Txt
                        v="xs"
                        bold={state !== 'done'}
                        tone={state === 'done' ? 'muted' : 'accent'}
                      >
                        {state === 'done' ? L.cleared : L.fee({ v: fmtValue(s.fee) })}
                      </Txt>
                      {next ? (
                        tour.triesLeft > 0 ? (
                          <Btn kind="primary" testID="tour-go" onPress={() => openStage(s)}>
                            {L.go}
                          </Btn>
                        ) : (
                          <Txt v="xs" tone="muted" testID="tour-no-tries">
                            {L.noTries}
                          </Txt>
                        )
                      ) : state === 'locked' ? (
                        <Txt v="xs" tone="muted">
                          {L.locked}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={{ gap: 4 }}>
              {[L.infoTries({ n: TOUR_TRIES_PER_DAY }), L.infoFee, L.infoDraw, L.infoWeek].map(
                (t) => (
                  <Txt key={t} v="xs" tone="muted">
                    {`· ${t}`}
                  </Txt>
                ),
              )}
            </View>
          </>
        ) : view === 'prep' && stage && draft ? (
          <>
            <View testID="tour-scout" style={[box, { gap: 6, padding: 14 }]}>
              <Txt bold>{L.scoutTitle}</Txt>
              <Txt>{`${L.oppOvr({ n: stage.opp })} · ${stage.formation} · ${L.oppTactic({ name: tourTacticName(stage.tactic) })}`}</Txt>
              <Txt v="xs" tone="muted">
                {L.oppHabit}
              </Txt>
              <Txt bold>{L.restriction}</Txt>
              {stage.rules.map((r, k) => rule(tourRuleText(r), String(k)))}
              <Txt v="xs" tone="muted">
                {L.merc({ n: stage.merc })}
              </Txt>
            </View>
            <Txt bold>{L.lineupTitle}</Txt>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={L.lineupTitle}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {FORMATION_IDS.map((f) => (
                <Opt
                  key={f}
                  testID={`tour-formation-${f}`}
                  selected={draft.formation === f}
                  accessibilityLabel={f}
                  onPress={() => setFormation(f)}
                >
                  <Txt bold>{f}</Txt>
                </Opt>
              ))}
              <Btn testID="tour-auto" onPress={auto}>
                {L.auto}
              </Btn>
            </View>
            <Txt v="xs" tone="muted">
              {L.pickSlot}
            </Txt>
            <TeamPitch
              formation={draft.formation}
              cells={pitchCells}
              selected={slotOpen}
              animate={false}
              onpick={(i) => {
                setSlotOpen((cur) => (cur === i ? null : i));
                setBenchOpen(false);
              }}
            />
            {slotOpen !== null ? (
              <View testID="tour-options" style={{ gap: 8 }}>
                <Press
                  testID="tour-clear"
                  accessibilityLabel={`${L.emptySlot}, ${L.mercName} ${stage.merc}`}
                  onPress={() => place(null)}
                  style={[box, { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }]}
                >
                  <Txt bold>{L.emptySlot}</Txt>
                  <Txt v="xs" tone="muted">{`${L.mercName} ${stage.merc}`}</Txt>
                </Press>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {options.map((o) => {
                    const p = byId.get(o.id);
                    if (!p) return null;
                    const nm = marketName(p, local);
                    const off = !!o.blocked;
                    return (
                      <Press
                        key={o.id}
                        testID={`tour-option-${o.id}`}
                        accessibilityLabel={`${nm} ${o.rating}${off ? `, ${o.blocked === 'rule' ? L.blocked : L.capFull}` : ''}`}
                        accessibilityState={{ disabled: off }}
                        disabled={off}
                        onPress={() => place(o.id)}
                        style={{ opacity: off ? 0.5 : 1, minHeight: 44 }}
                      >
                        <Mini
                          player={p}
                          name={nm}
                          rating={o.rating}
                          code={FORMATIONS[draft.formation][slotOpen]!}
                          note={off ? (o.blocked === 'rule' ? L.blocked : L.capFull) : null}
                          noteTone="bad"
                        />
                      </Press>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Txt bold testID="tour-bench-count" style={{ flexShrink: 1 }}>
                {L.benchTitle({ n: draft.bench.length, max: TOUR_LIVE.bench })}
              </Txt>
              <Btn
                sm
                testID="tour-bench"
                onPress={() => {
                  setBenchOpen((v) => !v);
                  setSlotOpen(null);
                }}
              >
                {benchOpen ? L.close : L.pickBench}
              </Btn>
            </View>
            <View
              testID="tour-bench-list"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {draft.bench.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <Press
                    key={id}
                    testID={`tour-bench-on-${id}`}
                    accessibilityLabel={marketName(p, local)}
                    accessibilityState={{ selected: true }}
                    onPress={() => toggleBench(id)}
                    style={{
                      minHeight: 44,
                      padding: 2,
                      borderRadius: RADIUS.sm,
                      borderWidth: 2,
                      borderColor: c.accentText,
                    }}
                  >
                    <Mini
                      player={p}
                      name={marketName(p, local)}
                      rating={p.peak}
                      code={detailPosOf(p)}
                    />
                  </Press>
                );
              })}
              {benchOpen
                ? benchOptions.map((o) => {
                    const p = byId.get(o.id);
                    if (!p) return null;
                    const full = draft.bench.length >= TOUR_LIVE.bench;
                    return (
                      <Press
                        key={o.id}
                        testID={`tour-bench-option-${o.id}`}
                        accessibilityLabel={marketName(p, local)}
                        accessibilityState={{ disabled: full }}
                        disabled={full}
                        onPress={() => toggleBench(o.id)}
                        style={{ opacity: full ? 0.5 : 1, minHeight: 44, padding: 2 }}
                      >
                        <Mini
                          player={p}
                          name={marketName(p, local)}
                          rating={p.peak}
                          code={detailPosOf(p)}
                        />
                      </Press>
                    );
                  })
                : null}
            </View>
            <Txt bold>{L.tacticPick}</Txt>
            {tacticGrid(
              TOUR_TACTICS.map((t) => {
                const e = tourEdge(t, stage.tactic);
                return { tactic: t, text: e.text, textTone: tone(e.edge) };
              }),
              draft.tactic,
              (t) => setDraft({ ...draft, tactic: t }),
              L.tacticPick,
            )}
            <Txt v="xs" tone="muted">
              {`${tourTacticDesc(draft.tactic)} · ${tourEdge(draft.tactic, stage.tactic).text}`}
            </Txt>
            {error ? (
              <Txt tone="bad" accessibilityRole="alert">
                {error}
              </Txt>
            ) : null}
            <Btn
              kind="primary"
              block
              testID="tour-depart"
              disabled={busy}
              onPress={() => void depart()}
            >
              {L.depart}
            </Btn>
          </>
        ) : (view === 'live' || view === 'result') && match ? (
          <>
            {(() => {
              const over = match.status !== 'live';
              return (
                <>
                  <View testID="tour-match" style={band}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Txt v="sm" tone="onPitch">
                        {tourStageName(match.stage)}
                      </Txt>
                      <Txt v="sm" tone="pitchAccent">
                        {over
                          ? match.status === 'won'
                            ? L.winTitle
                            : L.loseTitle
                          : `${L.minute({ n: span.from })} · ${L.timeout}`}
                      </Txt>
                    </View>
                    <Txt
                      center
                      tone="onPitch"
                      testID="tour-score"
                      style={{ fontFamily: DISPLAY[700], fontSize: rem(3), lineHeight: rem(3.2) }}
                    >
                      {`${match.goalsAgainst} : ${match.goalsFor}`}
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 4 }} accessible={false}>
                      {Array.from({ length: TOUR_LIVE.segments }, (_, i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: RADIUS.pill,
                            backgroundColor: i < match.done ? c.pitchAccent : c.chalk,
                            opacity: i < match.done ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </View>
                    <Txt v="xs" tone="onPitch">
                      {L.oppNow({ name: tourTacticName(match.oppTactic) })}
                    </Txt>
                  </View>
                  <View testID="tour-events" style={{ gap: 6 }}>
                    {match.events.length ? (
                      match.events.map((e, k) => (
                        <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
                          <Txt v="sm" num style={{ width: 36 }}>{`${e.minute}'`}</Txt>
                          <Txt
                            v="sm"
                            bold={e.side === 'away'}
                            tone={e.side === 'away' ? 'accent' : 'ink'}
                            style={{ flex: 1 }}
                          >
                            {goalText(e)}
                            {e.side === 'away' && e.assist
                              ? ` · ${L.assist({ name: e.assistId ? nameOf(e.assistId) : e.assist })}`
                              : ''}
                          </Txt>
                        </View>
                      ))
                    ) : (
                      <Txt v="sm" tone="muted">
                        {L.noGoals}
                      </Txt>
                    )}
                  </View>
                  {!over ? (
                    <>
                      <Txt bold>{L.timeout}</Txt>
                      <Txt v="xs" tone="muted">
                        {L.timeoutLead}
                      </Txt>
                      {tacticGrid(
                        chances.map((x) => ({
                          tactic: x.tactic,
                          text: L.chance({ n: x.pct }),
                          textTone: tone(x.diff),
                          now: x.tactic === match.tactic,
                        })),
                        orderTactic,
                        setOrderTactic,
                        L.timeout,
                      )}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Txt bold testID="tour-subs" style={{ flexShrink: 1 }}>
                          {L.subsLeft({ n: match.subsLeft - subs.length })}
                        </Txt>
                        <Txt v="xs" tone="muted" style={{ flex: 1, textAlign: 'right' }}>
                          {outSlot === null ? L.subPickOut : L.subPickIn}
                        </Txt>
                      </View>
                      <TeamPitch
                        formation={match.formation}
                        cells={livePitch}
                        selected={outSlot}
                        animate={false}
                        onpick={pickOut}
                      />
                      {liveCells
                        .filter((x) => x.tired)
                        .map((x) => (
                          <View
                            key={x.i}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <Txt v="sm" bold style={{ flex: 1 }}>{`${x.slot} ${x.name}`}</Txt>
                            <Txt v="sm" tone="bad">
                              {L.stamina({ n: x.stamina })}
                            </Txt>
                          </View>
                        ))}
                      <View
                        testID="tour-live-bench"
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                      >
                        {benchLeft.map((id) => {
                          const p = byId.get(id);
                          if (!p) return null;
                          const nm = marketName(p, local);
                          return (
                            <Press
                              key={id}
                              testID={`tour-sub-in-${id}`}
                              accessibilityLabel={nm}
                              accessibilityState={{ disabled: outSlot === null }}
                              disabled={outSlot === null}
                              onPress={() => pickIn(id)}
                              style={{
                                opacity: outSlot === null ? 0.5 : 1,
                                minHeight: 44,
                                padding: 2,
                              }}
                            >
                              <Mini
                                player={p}
                                name={nm}
                                rating={p.peak}
                                code={
                                  outSlot !== null
                                    ? FORMATIONS[match.formation][outSlot]!
                                    : detailPosOf(p)
                                }
                              />
                            </Press>
                          );
                        })}
                      </View>
                      {subs.map((s, k) => (
                        <View
                          key={s.slot}
                          testID="tour-sub"
                          style={[
                            box,
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              padding: 8,
                              paddingLeft: 12,
                            },
                          ]}
                        >
                          <Txt v="sm" style={{ flex: 1 }}>
                            <Txt v="sm" bold tone="bad">
                              {L.subOut}
                            </Txt>
                            {` ${nameOf(match.slotIds[s.slot] ?? null)} → `}
                            <Txt v="sm" bold tone="good">
                              {L.subIn}
                            </Txt>
                            {` ${nameOf(s.cardId)}`}
                          </Txt>
                          <Btn sm onPress={() => setSubs((cur) => cur.filter((_, i) => i !== k))}>
                            {L.subCancel}
                          </Btn>
                        </View>
                      ))}
                      {error ? (
                        <Txt tone="bad" accessibilityRole="alert">
                          {error}
                        </Txt>
                      ) : null}
                      <Btn
                        kind="primary"
                        block
                        testID="tour-continue"
                        disabled={busy}
                        onPress={() => void sendOrder()}
                      >
                        {L.continueBtn(span)}
                      </Btn>
                    </>
                  ) : (
                    <>
                      {match.result ? (
                        <>
                          {match.result.pens ? (
                            <Txt v="sm" tone="muted">
                              {L.pens}
                            </Txt>
                          ) : null}
                          {match.status === 'won' ? (
                            <>
                              <View
                                testID="tour-result-stars"
                                accessibilityLabel={L.starsOf({ n: match.result.stars, max: 3 })}
                                style={{ flexDirection: 'row', gap: 8 }}
                              >
                                {[L.starWin, L.starFirst, L.starMargin].map((label, i) => {
                                  const got =
                                    i === 0 ||
                                    (i === 1 && match.tryNo === 1) ||
                                    (i === 2 &&
                                      !match.result!.pens &&
                                      match.goalsFor - match.goalsAgainst >= 2);
                                  return (
                                    <View
                                      key={label}
                                      style={{ flex: 1, alignItems: 'center', gap: 2 }}
                                    >
                                      <Txt
                                        accessible={false}
                                        style={{
                                          fontSize: rem(3),
                                          lineHeight: rem(3.2),
                                          color: got ? c.warn : c.line,
                                        }}
                                      >
                                        ★
                                      </Txt>
                                      <Txt v="xs" tone="muted" center>
                                        {label}
                                      </Txt>
                                    </View>
                                  );
                                })}
                              </View>
                              <View style={band}>
                                {stats([
                                  {
                                    label: L.feeGot,
                                    value: `+${fmtValue(match.result.fee)}`,
                                    gold: true,
                                    testID: 'tour-fee',
                                  },
                                  { label: L.scoreGot, value: `+${match.result.score}` },
                                ])}
                              </View>
                            </>
                          ) : (
                            <Txt tone="muted">{L.loseHint}</Txt>
                          )}
                        </>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Btn block testID="tour-map-btn" onPress={() => setView('map')}>
                            {L.toMap}
                          </Btn>
                        </View>
                        {nextStage && tour.triesLeft > 0 ? (
                          <View style={{ flex: 1 }}>
                            <Btn
                              block
                              kind="primary"
                              testID="tour-next"
                              onPress={() => openStage(nextStage)}
                            >
                              {match.status === 'won' ? L.nextStage : L.again}
                            </Btn>
                          </View>
                        ) : null}
                      </View>
                    </>
                  )}
                </>
              );
            })()}
          </>
        ) : view === 'rank' ? (
          <>
            <Txt v="xs" tone="muted">
              {L.rankingLead}
            </Txt>
            {rankFailed ? (
              <Txt tone="muted">{L.rankingFail}</Txt>
            ) : !ranking ? (
              <Txt tone="muted">{L.loading}</Txt>
            ) : !ranking.rows.length ? (
              <Txt tone="muted" testID="tour-rank-empty">
                {L.rankingEmpty}
              </Txt>
            ) : (
              <View testID="tour-ranking">
                {ranking.rows.map((r) => (
                  <View
                    key={r.rank}
                    accessible
                    accessibilityLabel={`${L.rank({ n: r.rank })}, ${r.name}, ${L.rankingCleared({ n: r.cleared })}, ${r.stars}, ${r.score}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 52,
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                    }}
                  >
                    <Txt num style={{ width: 32 }}>
                      {String(r.rank)}
                    </Txt>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt bold numberOfLines={1}>
                        {r.name}
                      </Txt>
                      <Txt
                        v="xs"
                        tone="muted"
                      >{`${L.rankingCleared({ n: r.cleared })} · ★ ${r.stars}`}</Txt>
                    </View>
                    <Txt num style={{ fontSize: rem(1.2) }}>
                      {String(r.score)}
                    </Txt>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </View>
    </PopSheet>
  );
}
