import { useEffect, useRef, useState } from 'react';
import { Keyboard, View, useWindowDimensions } from 'react-native';
import {
  positionRole,
  slotRating,
  type FormationId,
  type TeamPosition,
} from '@offside/contracts/owner-team';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { assignSlot, attrLine } from '@offside/app-core/teamOwner';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { DragPlayer, type PlayerDrag } from '../../components/DragPlayer';
import { PlayerCard } from '../../components/PlayerCard';
import { PlayerPeek, type PeekOrigin } from '../../components/PlayerPeek';
import { TeamPitch, type PitchCell } from '../../components/TeamPitch';
import { useColors } from '../../theme/useColors';
import { prefs } from '../../store';
import { Btn, Card, Press, Txt } from '../../ui';
import { scrollTo, scrollY, viewH } from '../../ui/scroll';
import { TextField } from '../settings/parts';
import { RecordsChips as SortChips } from '../hof/RecordsControls';
import { DEFAULT_NATION, NATION_BY_CODE } from '@offside/contracts/nations';
import { tn } from '@offside/game/i18n/names';

type Drag = {
  index: number | null;
  id: string | null;
  x: number;
  y: number;
  rect: { x: number; y: number; w: number; h: number; scroll: number };
  root: { x: number; y: number };
  locker: { y: number; h: number } | null;
};
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function TeamLineup({
  formation,
  layout,
  slots,
  cells,
  players,
  editable,
  nameOf,
  selected,
  select,
  change,
  dragging,
  jumpRef,
  synLinks,
  synFocus,
  synApplied,
  synCaption,
}: {
  formation: FormationId;
  layout: TeamPosition[];
  slots: (string | null)[];
  cells: PitchCell[];
  players: TeamPlayer[];
  editable: boolean;
  nameOf: (p: TeamPlayer) => string;
  selected: string | null;
  select: (id: string | null) => void;
  change: (slots: (string | null)[], layout: TeamPosition[]) => void;
  dragging: (value: boolean) => void;
  jumpRef: React.RefObject<(() => void) | null>;
  /** T-11-105 시너지 연결선·고른 시너지의 선수 자리. */
  synLinks: readonly { members: readonly number[]; on: boolean }[];
  synFocus: readonly number[] | null;
  synApplied: readonly number[];
  synCaption: string | null;
}) {
  const c = useColors();
  const { height } = useWindowDimensions();
  const pitch = useRef<View>(null);
  const root = useRef<View>(null);
  const locker = useRef<View>(null);
  const active = useRef<Drag | null>(null);
  const gestureVersion = useRef(0);
  const [ghost, setGhost] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<TeamPosition[] | null>(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('all');
  const [sort, setSort] = useState('ovr');
  const [starters, setStarters] = useState(false);
  const [guide, setGuide] = useState(false);
  const [limit, setLimit] = useState(24);
  useEffect(() => setLimit(24), [query, position, sort, starters]);
  const [focus, setFocus] = useState<number | null>(null);
  // 카드 팝업 — 짧게 누른 자리만 연다. 드래그(길게 눌러 끌기)가 시작·끝난 직후의 누름은 무시한다.
  const [peek, setPeek] = useState<{ i: number; origin: PeekOrigin } | null>(null);
  const dragAt = useRef(0);
  function openPeek(i: number) {
    if (active.current || Date.now() - dragAt.current < 300) return;
    const pos = layout[i];
    if (!pos || !slots[i] || cells[i]?.youth) return;
    pitch.current?.measureInWindow((px, py, w, h) => {
      if (!w || !h || active.current) return;
      // 자리 카드는 62×88, 가운데가 자리 좌표(TeamPitch).
      setPeek({ i, origin: { x: px + (pos.x / 100) * w - 31, y: py + (pos.y / 100) * h - 44, w: 62, h: 88 } });
    });
  }
  const latest = useRef({ layout, slots, change, dragging });
  latest.current = { layout, slots, change, dragging };
  useEffect(() => {
    jumpRef.current = () => {
      Keyboard.dismiss();
      pitch.current?.measureInWindow((_x, y) =>
        scrollTo(Math.max(0, scrollY() + y - 60), prefs.motionOK),
      );
    };
    return () => {
      jumpRef.current = null;
      dragging(false);
    };
  }, [jumpRef, dragging]);
  function point(d: Drag, x: number, y: number) {
    const top = d.rect.y - (scrollY() - d.rect.scroll);
    const px = clamp(((x - d.rect.x) / d.rect.w) * 100, 8, 92);
    const py = clamp(((y - top) / d.rect.h) * 100, d.index === 0 ? 84 : 8, d.index === 0 ? 94 : 82);
    const roundedX = Math.round(px * 10) / 10;
    const roundedY = Math.round(py * 10) / 10;
    return { x: roundedX, y: roundedY, slot: positionRole(roundedX, roundedY, d.index ?? 1) };
  }
  function update(x: number, y: number) {
    const d = active.current;
    if (!d) return;
    active.current = { ...d, x, y };
    setGhost(active.current);
    if (d.index !== null)
      setPreview(latest.current.layout.map((p, i) => (i === d.index ? point(d, x, y) : p)));
  }
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
            dragging(true);
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
        const state = latest.current;
        const lockerTop = d.locker ? d.locker.y - (scrollY() - d.rect.scroll) : Infinity;
        if (d.index !== null && d.locker && y >= lockerTop && y <= lockerTop + d.locker.h) {
          state.change(assignSlot(state.slots, d.index, null), state.layout);
          select(null);
          setFocus(null);
        } else if (d.index !== null)
          state.change(
            state.slots,
            state.layout.map((p, i) => (i === d.index ? point(d, x, y) : p)),
          );
        else {
          const top = d.rect.y - (scrollY() - d.rect.scroll);
          if (x >= d.rect.x && x <= d.rect.x + d.rect.w && y >= top && y <= top + d.rect.h) {
            const nearest = state.layout.reduce(
              (best, p, i) => {
                const distance = Math.hypot(
                  d.rect.x + (p.x / 100) * d.rect.w - x,
                  top + (p.y / 100) * d.rect.h - y,
                );
                return distance < best.distance ? { distance, i } : best;
              },
              { distance: Infinity, i: 0 },
            ).i;
            state.change(assignSlot(state.slots, nearest, d.id), state.layout);
            select(null);
            setFocus(nearest);
          }
        }
      }
      active.current = null;
      setGhost(null);
      setPreview(null);
      dragging(false);
    },
  };
  const code = layout[focus ?? 9]?.slot ?? 'ST';
  const visible = players
    .filter(
      (p) =>
        (starters || !slots.includes(p.careerId) || p.careerId === selected) &&
        (position === 'all' || p.pos === position) &&
        nameOf(p).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (sort === 'ls'
          ? (b.legendScore ?? 0) - (a.legendScore ?? 0)
          : sort === 'fit'
            ? slotRating(code, b) - slotRating(code, a)
            : b.peak - a.peak) || a.careerId.localeCompare(b.careerId),
    );
  const ghostPlayer = ghost?.id ? players.find((p) => p.careerId === ghost.id) : null;
  const ghostCell =
    ghost?.index !== null && ghost?.index !== undefined
      ? cells[ghost.index]
      : ghostPlayer
        ? {
            name: nameOf(ghostPlayer),
            nation: ghostPlayer.nation,
            season: ghostPlayer.season,
            rating: ghostPlayer.peak,
            peak: ghostPlayer.peak,
            number: ghostPlayer.number,
            legendScore: ghostPlayer.legendScore,
            youth: false,
          }
        : null;
  return (
    <View ref={root} collapsable={false} style={{ gap: 14 }}>
      <TeamPitch
        onplace={
          editable && selected
            ? (x, y) => {
                pitch.current?.measureInWindow((_px, _py, w, h) => {
                  const px = (x / w) * 100;
                  const py = (y / h) * 100;
                  const index = layout.reduce(
                    (best, p, i) =>
                      Math.hypot((p.x - px) * w, (p.y - py) * h) < best.distance
                        ? { distance: Math.hypot((p.x - px) * w, (p.y - py) * h), i }
                        : best,
                    { distance: Infinity, i: 0 },
                  ).i;
                  const nextX = Math.round(clamp(px, 8, 92) * 10) / 10;
                  const nextY =
                    Math.round(clamp(py, index === 0 ? 84 : 8, index === 0 ? 94 : 82) * 10) / 10;
                  change(
                    assignSlot(slots, index, selected),
                    layout.map((p, i) =>
                      i === index
                        ? { x: nextX, y: nextY, slot: positionRole(nextX, nextY, index) }
                        : p,
                    ),
                  );
                  select(null);
                  setFocus(index);
                });
              }
            : undefined
        }
        formation={formation}
        layout={preview ?? layout}
        cells={cells}
        pitchRef={pitch}
        selected={focus}
        links={synLinks}
        focus={synFocus}
        applied={synApplied}
        caption={synCaption}
        ondrag={editable ? drag : undefined}
        onpick={
          editable
            ? (i) => {
                setFocus(i);
                if (selected) {
                  change(assignSlot(slots, i, selected), layout);
                  select(null);
                } else openPeek(i);
              }
            : openPeek
        }
      />
      {editable && focus !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="sm" style={{ flex: 1 }}>{`${layout[focus]?.slot} · ${cells[focus]?.name}`}</Txt>
          {slots[focus] ? (
            <Btn sm onPress={() => change(assignSlot(slots, focus, null), layout)}>
              {L.toLocker}
            </Btn>
          ) : null}
          <Btn sm kind="ghost" onPress={() => setFocus(null)}>
            {L.close}
          </Btn>
        </View>
      ) : null}
      {editable ? (
        <View ref={locker} collapsable={false}>
          <Card gap={12}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Txt v="h2">{L.lockerTitle}</Txt>
              <Txt tone="muted" v="sm">
                {L.lockerCountApp({ n: visible.length })}
              </Txt>
            </View>
            <Txt v="sm" tone="muted">
              {L.lockerNoteApp}
            </Txt>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={L.searchPlaceholder}
              accessibilityLabel={L.searchPlaceholder}
              testID="locker-search"
            />
            <SortChips
              label={L.posLabelApp}
              items={['all', 'GK', 'DF', 'MF', 'FW'].map((value) => ({
                key: value,
                label: (
                  {
                    all: L.posAllApp,
                    GK: L.posGkApp,
                    DF: L.posDfApp,
                    MF: L.posMfApp,
                    FW: L.posFwApp,
                  } as Record<string, string>
                )[value]!,
              }))}
              value={position}
              onPick={setPosition}
              testIDPrefix="locker-position"
            />
            <SortChips
              label={L.sortLabelApp}
              items={[
                { key: 'ovr', label: 'OVR' },
                { key: 'ls', label: 'LS' },
                { key: 'fit', label: L.fitApp({ code }) },
              ]}
              value={sort}
              onPick={setSort}
              testIDPrefix="locker-sort"
            />
            <Press
              onPress={() => setStarters(!starters)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: starters }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Txt v="sm">{L.startersToggleApp({ on: starters })}</Txt>
            </Press>
            <Press
              onPress={() => setGuide(!guide)}
              accessibilityState={{ expanded: guide }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Txt v="sm" tone="muted">
                {L.guideToggleApp({ open: guide })}
              </Txt>
            </Press>
            {guide ? (
              <Txt v="sm" tone="muted">
                {L.guideBodyApp}
              </Txt>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {visible.slice(0, limit).map((p) => (
                <View key={p.careerId} style={{ width: '48%' }}>
                  <DragPlayer index={null} id={p.careerId} drag={drag}>
                    <Press
                      testID={`locker-${p.careerId}`}
                      accessibilityLabel={L.lockerPickAriaApp({
                        who: `${nameOf(p)}${NATION_BY_CODE.get(p.nation ?? DEFAULT_NATION) ? ` · ${tn(NATION_BY_CODE.get(p.nation ?? DEFAULT_NATION)!.ko)}` : ''}`,
                        peak: p.peak,
                        ls: p.legendScore ?? 0,
                        attrs: attrLine(p) ?? L.noAttrs,
                      })}
                      accessibilityState={{ selected: selected === p.careerId }}
                      onPress={() => select(selected === p.careerId ? null : p.careerId)}
                      style={{
                        borderRadius: 12,
                        borderWidth: selected === p.careerId ? 2 : 0,
                        borderColor: c.accent,
                      }}
                    >
                      <PlayerCard
                        cell={{
                          name: nameOf(p),
                          nation: p.nation,
                          season: p.season,
                          rating: p.peak,
                          number: p.number,
                          legendScore: p.legendScore,
                          attrs: p.attrs,
                          attrsEstimated: p.attrsEstimated,
                          cardValue: p.cardValue,
                          pos: p.pos,
                          type: p.type,
                          youth: false,
                        }}
                        code={p.dpos ?? p.pos}
                      />
                    </Press>
                  </DragPlayer>
                  <Txt v="xs" tone="muted" style={{ textAlign: 'center' }}>
                    {slots.includes(p.careerId)
                      ? L.rosterStarting({ slot: layout[slots.indexOf(p.careerId)]?.slot ?? '' })
                      : L.rosterBench}
                  </Txt>
                </View>
              ))}
            </View>
            {visible.length > limit ? (
              <Btn sm onPress={() => setLimit(limit + 24)}>
                {L.moreApp}
              </Btn>
            ) : null}
            {!visible.length ? (
              <Txt tone="muted" v="sm">
                {players.length ? L.emptyFilteredApp : L.emptyNoneApp}
              </Txt>
            ) : null}
          </Card>
        </View>
      ) : null}
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
            code={
              ghost.index !== null
                ? (preview ?? layout)[ghost.index]!.slot
                : (ghostPlayer?.dpos ?? ghostPlayer?.pos ?? '')
            }
            compact
            animate={false}
          />
        </View>
      ) : null}
      {peek && slots[peek.i] && cells[peek.i]
        ? (() => {
            const p = players.find((x) => x.careerId === slots[peek.i]);
            return p ? (
              <PlayerPeek
                player={p}
                name={cells[peek.i]!.name}
                rating={cells[peek.i]!.rating}
                slot={layout[peek.i]!.slot}
                origin={peek.origin}
                onclose={() => setPeek(null)}
              />
            ) : null;
          })()
        : null}
    </View>
  );
}
