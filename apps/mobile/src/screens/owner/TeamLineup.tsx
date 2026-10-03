import { useEffect, useRef, useState } from 'react';
import { Keyboard, View, useWindowDimensions } from 'react-native';
import {
  positionRole,
  slotRating,
  type FormationId,
  type TeamPosition,
} from '@offside/contracts/owner-team';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { assignSlot } from '@offside/app-core/teamOwner';
import { DragPlayer, type PlayerDrag } from '../../components/DragPlayer';
import { PlayerCard } from '../../components/PlayerCard';
import { TeamPitch, type PitchCell } from '../../components/TeamPitch';
import { useColors } from '../../theme/useColors';
import { prefs } from '../../store';
import { Btn, Card, Press, Txt } from '../../ui';
import { scrollTo, scrollY, viewH } from '../../ui/scroll';
import { TextField } from '../settings/parts';
import { SortChips } from '../board/parts';

type Drag = {
  index: number | null;
  id: string | null;
  x: number;
  y: number;
  rect: { x: number; y: number; w: number; h: number; scroll: number };
  root: { x: number; y: number };
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
}) {
  const c = useColors();
  const { height } = useWindowDimensions();
  const pitch = useRef<View>(null);
  const root = useRef<View>(null);
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
      const version = ++gestureVersion.current;
      root.current?.measureInWindow((rx, ry) =>
        pitch.current?.measureInWindow((px, py, w, h) => {
          if (version !== gestureVersion.current || !w || !h) return;
          active.current = {
            index,
            id,
            x,
            y,
            root: { x: rx, y: ry },
            rect: { x: px, y: py, w, h, scroll: scrollY() },
          };
          setGhost(active.current);
          dragging(true);
        }),
      );
    },
    move: update,
    end(x, y, success) {
      gestureVersion.current++;
      const d = active.current;
      if (d && success) {
        const state = latest.current;
        if (d.index !== null)
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
        ondrag={editable ? drag : undefined}
        onpick={
          editable
            ? (i) => {
                setFocus(i);
                if (selected) {
                  change(assignSlot(slots, i, selected), layout);
                  select(null);
                }
              }
            : undefined
        }
      />
      {editable && focus !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="sm" style={{ flex: 1 }}>{`${layout[focus]?.slot} · ${cells[focus]?.name}`}</Txt>
          {slots[focus] ? (
            <Btn sm onPress={() => change(assignSlot(slots, focus, null), layout)}>
              라커룸으로
            </Btn>
          ) : null}
          <Btn sm kind="ghost" onPress={() => setFocus(null)}>
            닫기
          </Btn>
        </View>
      ) : null}
      {editable ? (
        <Card gap={12}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Txt v="h2">라커룸</Txt>
            <Txt tone="muted" v="sm">{`${visible.length}명`}</Txt>
          </View>
          <Txt v="sm" tone="muted">
            선수를 길게 눌러 그라운드로 끌거나, 고른 뒤 자리를 눌러 주세요.
          </Txt>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="선수 이름 검색"
            accessibilityLabel="선수 이름 검색"
            testID="locker-search"
          />
          <SortChips
            label="포지션"
            items={['all', 'GK', 'DF', 'MF', 'FW'].map((value) => ({
              key: value,
              label: (
                { all: '전체', GK: '골키퍼', DF: '수비', MF: '중원', FW: '공격' } as Record<
                  string,
                  string
                >
              )[value]!,
            }))}
            value={position}
            onPick={setPosition}
            testIDPrefix="locker-position"
          />
          <SortChips
            label="정렬"
            items={[
              { key: 'ovr', label: 'OVR' },
              { key: 'ls', label: 'LS' },
              { key: 'fit', label: `${code} 적합` },
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
            <Txt v="sm">{`${starters ? '☑' : '□'} 선발 선수도 보기`}</Txt>
          </Press>
          <Press
            onPress={() => setGuide(!guide)}
            accessibilityState={{ expanded: guide }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Txt v="sm" tone="muted">{`OVR이 달라지는 이유 ${guide ? '−' : '+'}`}</Txt>
          </Press>
          {guide ? (
            <Txt v="sm" tone="muted">
              라커룸의 OVR은 커리어 최고 실력이에요. 그라운드의 ‘배치’는 해당 자리에서 뛰는
              실력으로, 포지션별 능력치와 적합도에 따라 달라져요. 팀 OVR과 경기에는 배치 OVR이
              반영돼요.
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {visible.slice(0, limit).map((p) => (
              <View key={p.careerId} style={{ width: '31.5%' }}>
                <DragPlayer index={null} id={p.careerId} drag={drag}>
                  <Press
                    testID={`locker-${p.careerId}`}
                    accessibilityLabel={`${nameOf(p)} · 최고 OVR ${p.peak} · LS ${p.legendScore ?? 0}`}
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
                        rating: p.peak,
                        number: p.number,
                        legendScore: p.legendScore,
                        youth: false,
                      }}
                      code={p.dpos ?? p.pos}
                    />
                  </Press>
                </DragPlayer>
                <Txt v="xs" tone="muted" style={{ textAlign: 'center' }}>
                  {slots.includes(p.careerId)
                    ? `선발 · ${layout[slots.indexOf(p.careerId)]?.slot}`
                    : '대기'}
                </Txt>
              </View>
            ))}
          </View>
          {visible.length > limit ? (
            <Btn sm onPress={() => setLimit(limit + 24)}>
              선수 더 보기
            </Btn>
          ) : null}
          {!visible.length ? (
            <Txt tone="muted" v="sm">
              {players.length
                ? '조건에 맞는 대기 선수가 없어요. 선발 선수도 보거나 필터를 바꿔 주세요.'
                : '이번 시즌에 커리어를 끝까지 뛰고 은퇴한 선수를 배치할 수 있어요.'}
            </Txt>
          ) : null}
        </Card>
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
    </View>
  );
}
