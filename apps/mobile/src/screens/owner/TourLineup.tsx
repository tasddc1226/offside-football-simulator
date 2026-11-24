// T-11-827 원정 투어 편성(웹 owner/TourLineup.svelte). 팀 그라운드(TeamLineup)와 같은 방식이다: 그라운드 + 교체 명단 + 라커룸,
// 선수를 고른 뒤 자리를 누르거나 카드를 길게 눌러 끌어다 놓는다(라커룸 → 자리, 자리 → 자리 맞바꿈, 자리 → 라커룸 비움).
// 선발은 이번 시즌 카드만 세울 수 있고 지난 시즌 카드는 교체 명단에만 간다. 자유 배치 · 시너지 · 공유 · 잠금 · 강화는 투어에 없다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View, useWindowDimensions } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import { FORMATIONS, presetLayout } from '@offside/contracts/owner-team';
import { detailPosOf } from '@offside/contracts/positions';
import type { TourStage } from '@offside/contracts';
import type { TeamPlayer } from '@offside/app-core/api/team';
import {
  TOUR_LIVE,
  tourAssign,
  tourLocker,
  tourToggleBench,
  type TourDraft,
  type TourPick,
} from '@offside/app-core/tour';
import { tourText as L } from '@offside/app-core/i18n/ko/tour';
import { teamHomeText as TH } from '@offside/app-core/i18n/ko/teamHome';
import { DragPlayer, type PlayerDrag } from '../../components/DragPlayer';
import { PlayerCard, type PlayerCardData } from '../../components/PlayerCard';
import { TeamPitch } from '../../components/TeamPitch';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Txt } from '../../ui';
import { scrollTo, scrollY, viewH } from '../../ui/scroll';
import { RecordsChips as SortChips } from '../hof/RecordsControls';

/** 선수 한 명을 그라운드 · 라커룸 카드 값으로(rating은 그 자리 실력, 빈 자리는 팀 화면의 유소년 카드 모양). */
export const cellOf = (p: TeamPlayer | undefined, name: string, rating: number): PlayerCardData =>
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
        attrs: p.attrs,
        attrsEstimated: p.attrsEstimated,
        height: p.height,
        weight: p.weight,
        foot: p.foot,
        cardValue: p.cardValue,
        pos: p.pos,
        type: p.type,
      }
    : { name, rating, youth: true };

type Block = 'season' | 'rule' | 'cap' | null;
type Drag = {
  index: number | null;
  id: string | null;
  x: number;
  y: number;
  rect: { x: number; y: number; w: number; h: number; scroll: number };
  root: { x: number; y: number };
  locker: { y: number; h: number } | null;
};
const POSITIONS = ['all', 'FW', 'MF', 'DF', 'GK'] as const;
const PAGE = 24;

export function TourLineup({
  draft,
  onChange,
  stage,
  picks,
  season,
  byId,
  nameOf,
  cells,
  dragging,
}: {
  draft: TourDraft;
  onChange: (d: TourDraft) => void;
  stage: TourStage;
  picks: readonly TourPick[];
  season: number;
  byId: ReadonlyMap<string, TeamPlayer>;
  nameOf: (id: string | null) => string;
  /** 선발 11자리의 그라운드 카드(빈 자리는 현지 용병). */
  cells: readonly PlayerCardData[];
  /** 끌기 중에는 화면 스크롤을 잠근다. */
  dragging: (value: boolean) => void;
}) {
  const c = useColors();
  const { height } = useWindowDimensions();
  const slots = FORMATIONS[draft.formation];
  const positions = presetLayout(draft.formation);
  const pitch = useRef<View>(null);
  const root = useRef<View>(null);
  const locker = useRef<View>(null);
  const active = useRef<Drag | null>(null);
  const gestureVersion = useRef(0);
  const dragAt = useRef(0);
  const [ghost, setGhost] = useState<Drag | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('all');
  const [limit, setLimit] = useState(PAGE);
  const [note, setNote] = useState('');
  useEffect(() => setLimit(PAGE), [position]);

  // 끌 때마다 다시 그려지므로 편성 · 고른 자리가 바뀔 때만 계산한다.
  const rows = useMemo(
    () => tourLocker(draft, picks, stage.rules, season, selectedSlot),
    [draft, picks, stage.rules, season, selectedSlot],
  );
  const startable = rows.filter((r) => r.blocked !== 'season' && r.blocked !== 'rule').length;
  const roster = rows.filter((r) => position === 'all' || byId.get(r.id)?.pos === position);
  const blockText = (b: Block) =>
    b === 'season' ? L.blockedSeason : b === 'rule' ? L.blocked : b === 'cap' ? L.capFull : '';

  /** 카드를 자리 i에 세운다. 세울 수 없으면 이유를 알리고 그대로 둔다. */
  function assign(i: number, id: string) {
    const row = tourLocker(draft, picks, stage.rules, season, i).find((r) => r.id === id);
    if (!row || row.blocked) {
      setNote(`${nameOf(id)} · ${blockText(row?.blocked ?? 'rule')}`);
      return;
    }
    onChange(tourAssign(draft, i, id));
    setNote(TH.placedIn({ name: nameOf(id), pos: slots[i]! }));
    setSelectedCard(null);
    setSelectedSlot(i);
  }
  function clear(i: number) {
    if (!draft.slotIds[i]) return;
    onChange(tourAssign(draft, i, null));
    setNote(TH.sentToLocker);
  }
  /** 자리 a의 선수를 자리 b로(자리끼리 맞바꿈). */
  function swap(a: number, b: number) {
    const id = draft.slotIds[a];
    if (!id) return;
    onChange(tourAssign(draft, b, id));
    setSelectedSlot(b);
    setNote(TH.swapped);
  }
  function bench(id: string) {
    if (!draft.bench.includes(id) && draft.bench.length >= TOUR_LIVE.bench)
      return setNote(L.benchFull);
    onChange(tourToggleBench(draft, id));
    if (selectedCard === id) setSelectedCard(null);
  }
  function pickCard(id: string, blocked: Block, at: number) {
    // 자리를 골라 둔 채 카드를 누르면 그 자리에 세운다(웹과 같다).
    if (selectedSlot !== null && selectedCard === null && at !== selectedSlot && !blocked)
      return assign(selectedSlot, id);
    if (blocked && at < 0) return setNote(`${nameOf(id)} · ${blockText(blocked)}`);
    setSelectedCard((cur) => (cur === id ? null : id));
  }
  function pickSlot(i: number) {
    if (Date.now() - dragAt.current < 300) return;
    if (selectedCard) assign(i, selectedCard);
    else setSelectedSlot((cur) => (cur === i ? null : i));
  }

  // ── 끌어 놓기 ── 콜백은 매 렌더 새로 만들어 두고 ref로 읽는다(DragPlayer가 처음 쥔 제스처가 옛 draft를 보지 않게).
  const latest = useRef({ assign, clear, swap, positions, dragging });
  latest.current = { assign, clear, swap, positions, dragging };
  useEffect(() => () => latest.current.dragging(false), []);
  function update(x: number, y: number) {
    const d = active.current;
    if (!d) return;
    active.current = { ...d, x, y };
    setGhost(active.current);
  }
  // 끌면서 화면 위 · 아래 가장자리에 닿으면 스크롤한다(라커룸 ↔ 그라운드를 오가야 해서).
  useEffect(() => {
    if (!ghost) return;
    const timer = setInterval(() => {
      const d = active.current;
      if (!d) return;
      const bottom = Math.min(height - 160, viewH());
      const delta = d.y < 130 ? -14 : d.y > bottom - 65 ? 14 : 0;
      if (delta) {
        scrollTo(Math.max(0, scrollY() + delta));
        update(d.x, d.y);
      }
    }, 60);
    return () => clearInterval(timer);
    // ghost 유무만 본다(좌표가 바뀔 때마다 타이머를 새로 만들지 않는다).
  }, [!!ghost, height]);
  const drag: PlayerDrag = {
    start(index, id, x, y) {
      Keyboard.dismiss();
      dragAt.current = Date.now();
      const version = ++gestureVersion.current;
      root.current?.measureInWindow((rx, ry) =>
        pitch.current?.measureInWindow((px, py, w, h) => {
          if (version !== gestureVersion.current || !w || !h) return;
          const begin = (ly?: number, lh?: number) => {
            if (version !== gestureVersion.current) return;
            active.current = {
              index,
              id,
              x,
              y,
              root: { x: rx, y: ry },
              rect: { x: px, y: py, w, h, scroll: scrollY() },
              locker: ly !== undefined && lh !== undefined ? { y: ly, h: lh } : null,
            };
            setGhost(active.current);
            latest.current.dragging(true);
          };
          if (locker.current) locker.current.measureInWindow((_x, ly, _w, lh) => begin(ly, lh));
          else begin();
        }),
      );
    },
    move: update,
    end(x, y, success) {
      gestureVersion.current++;
      dragAt.current = Date.now();
      const d = active.current;
      if (d && success) {
        const s = latest.current;
        const shift = scrollY() - d.rect.scroll;
        const lockerTop = d.locker ? d.locker.y - shift : Infinity;
        const top = d.rect.y - shift;
        if (d.index !== null && d.locker && y >= lockerTop && y <= lockerTop + d.locker.h) {
          s.clear(d.index);
        } else if (x >= d.rect.x && x <= d.rect.x + d.rect.w && y >= top && y <= top + d.rect.h) {
          const nearest = s.positions.reduce(
            (best, p, i) => {
              const distance = Math.hypot(
                d.rect.x + (p.x / 100) * d.rect.w - x,
                top + (p.y / 100) * d.rect.h - y,
              );
              return distance < best.distance ? { distance, i } : best;
            },
            { distance: Infinity, i: 0 },
          ).i;
          if (d.index !== null) {
            if (nearest !== d.index) s.swap(d.index, nearest);
          } else if (d.id) s.assign(nearest, d.id);
        }
      }
      active.current = null;
      setGhost(null);
      latest.current.dragging(false);
    },
  };

  const ghostPlayer = ghost?.id ? byId.get(ghost.id) : undefined;
  const ghostCell =
    ghost && ghost.index !== null
      ? cells[ghost.index]
      : ghostPlayer
        ? cellOf(ghostPlayer, nameOf(ghostPlayer.careerId), ghostPlayer.peak)
        : null;
  const chosen = selectedCard ? byId.get(selectedCard) : undefined;

  return (
    <View ref={root} collapsable={false} style={{ gap: 14 }}>
      <Txt v="xs" tone="muted">
        {L.starterSeason}
      </Txt>
      <TeamPitch
        formation={draft.formation}
        cells={cells}
        pitchRef={pitch}
        selected={selectedSlot}
        animate={false}
        ondrag={drag}
        onpick={pickSlot}
      />
      <View
        testID="tour-bar"
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
      >
        {chosen && selectedCard ? (
          <>
            <Txt v="sm" style={{ flex: 1 }}>
              <Txt v="sm" bold>
                {nameOf(selectedCard)}
              </Txt>
              {` · ${TH.chosen}`}
            </Txt>
            <Btn sm kind="ghost" onPress={() => setSelectedCard(null)}>
              {TH.cancel}
            </Btn>
          </>
        ) : selectedSlot !== null ? (
          <>
            <Txt v="sm" style={{ flex: 1 }}>
              <Txt v="sm" bold>
                {cells[selectedSlot]?.name ?? ''}
              </Txt>
              {` · ${slots[selectedSlot]}`}
            </Txt>
            {draft.slotIds[selectedSlot] ? (
              <Btn sm testID="tour-clear" onPress={() => clear(selectedSlot)}>
                {L.emptySlot}
              </Btn>
            ) : null}
            <Btn sm kind="ghost" onPress={() => setSelectedSlot(null)}>
              {TH.close}
            </Btn>
          </>
        ) : (
          <Txt v="xs" tone="muted" style={{ flex: 1 }}>
            {L.pickSlot}
          </Txt>
        )}
      </View>
      {note ? (
        <Txt v="xs" tone="muted" testID="tour-note" accessibilityLiveRegion="polite">
          {note}
        </Txt>
      ) : null}

      <View style={{ gap: 8 }}>
        <Txt bold testID="tour-bench-count">
          {L.benchTitle({ n: draft.bench.length, max: TOUR_LIVE.bench })}
        </Txt>
        {draft.bench.length ? (
          <View testID="tour-bench-list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {draft.bench.map((id) => {
              const p = byId.get(id);
              if (!p) return null;
              const name = nameOf(id);
              return (
                <Press
                  key={id}
                  testID={`tour-bench-on-${id}`}
                  accessibilityLabel={`${name} · ${L.offBench}`}
                  onPress={() => bench(id)}
                  style={{ minHeight: 44, padding: 2, borderRadius: RADIUS.sm }}
                >
                  <View style={{ width: 76, alignItems: 'center', gap: 4 }}>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={{ width: 64 }}
                    >
                      <PlayerCard
                        compact
                        mini
                        animate={false}
                        code={detailPosOf(p)}
                        cell={cellOf(p, name, p.peak)}
                      />
                    </View>
                    <Txt v="xs" numberOfLines={1} style={{ maxWidth: 76 }}>
                      {name}
                    </Txt>
                  </View>
                </Press>
              );
            })}
          </View>
        ) : (
          <Txt v="xs" tone="muted" testID="tour-bench-list">
            {L.benchEmpty}
          </Txt>
        )}
      </View>

      <View ref={locker} collapsable={false} testID="tour-locker">
        <Card gap={12}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="h2">{TH.lockerTitle}</Txt>
              <Txt v="xs" tone="muted">
                {L.lockerLead({ n: startable })}
              </Txt>
            </View>
            <Txt v="xs" tone="muted">
              {selectedSlot !== null ? L.sortFit : L.sortBest}
            </Txt>
          </View>
          <SortChips
            label={TH.posLabelApp}
            items={POSITIONS.map((value) => ({
              key: value,
              label: {
                all: TH.posAllApp,
                FW: TH.posFwApp,
                MF: TH.posMfApp,
                DF: TH.posDfApp,
                GK: TH.posGkApp,
              }[value],
            }))}
            value={position}
            onPick={(v) => setPosition(v as (typeof POSITIONS)[number])}
            testIDPrefix="tour-locker-position"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {roster.slice(0, limit).map((r) => {
              const p = byId.get(r.id);
              if (!p) return null;
              const name = nameOf(r.id);
              const off = !!r.blocked && r.at < 0;
              const benchOff = !r.playable || (!r.bench && draft.bench.length >= TOUR_LIVE.bench);
              return (
                <View key={r.id} style={{ width: '48%', alignItems: 'center', gap: 4 }}>
                  {/* 못 세우는 카드는 끌 수 없다(교체 명단 버튼만 쓴다). */}
                  <View style={{ width: '100%' }}>
                    <DragPlayer index={null} id={r.id} drag={off ? undefined : drag}>
                      <Press
                        testID={`tour-locker-${r.id}`}
                        accessibilityLabel={`${name} · ${TH.posOvr({ n: r.rating })}`}
                        accessibilityState={{ selected: selectedCard === r.id }}
                        onPress={() => pickCard(r.id, r.blocked, r.at)}
                        style={{
                          borderRadius: RADIUS.md,
                          borderWidth: selectedCard === r.id ? 2 : 0,
                          borderColor: c.accent,
                          opacity: off ? 0.6 : 1,
                        }}
                      >
                        <PlayerCard
                          animate={false}
                          code={selectedSlot !== null ? slots[selectedSlot]! : detailPosOf(p)}
                          cell={cellOf(p, name, r.rating)}
                        />
                      </Press>
                    </DragPlayer>
                  </View>
                  <Txt
                    v="xs"
                    tone={r.at >= 0 || r.bench ? 'good' : 'muted'}
                    bold={r.at >= 0 || r.bench}
                  >
                    {r.at >= 0
                      ? L.stateStart({ slot: slots[r.at]! })
                      : r.bench
                        ? L.stateBench
                        : L.stateWait}
                  </Txt>
                  {off ? (
                    <Txt v="xs" tone="bad" center>
                      {blockText(r.blocked)}
                    </Txt>
                  ) : null}
                  <Btn
                    sm
                    kind={r.bench ? 'primary' : 'default'}
                    testID={`tour-locker-bench-${r.id}`}
                    accessibilityLabel={`${name} · ${r.bench ? L.offBench : L.toBench}`}
                    disabled={benchOff}
                    onPress={() => bench(r.id)}
                  >
                    {r.bench ? L.offBench : L.toBench}
                  </Btn>
                </View>
              );
            })}
          </View>
          {roster.length > limit ? (
            <Btn sm onPress={() => setLimit(limit + PAGE)}>
              {TH.moreApp}
            </Btn>
          ) : null}
          {!roster.length ? (
            <Txt tone="muted" v="sm">
              {TH.noMatch}
            </Txt>
          ) : null}
        </Card>
      </View>

      {ghost && ghostCell ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ghost.x - ghost.root.x - 35,
            top: ghost.y - ghost.root.y + (scrollY() - ghost.rect.scroll) - 44,
            width: 70,
            zIndex: 100,
            opacity: 0.9,
          }}
        >
          <PlayerCard
            cell={ghostCell}
            code={ghost.index !== null ? slots[ghost.index]! : detailPosOf(ghostPlayer!)}
            compact
            animate={false}
          />
        </View>
      ) : null}
    </View>
  );
}
