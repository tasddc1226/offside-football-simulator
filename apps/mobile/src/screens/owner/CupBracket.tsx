import { alpha } from '../../theme/colors';
import { useSnapshot } from 'valtio';
import { prefs } from '../../store';
import { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BRACKET as B, cupBracket, type BracketNode } from '@offside/app-core/cupBracket';
import type { CupMatch, CupResponse } from '@offside/app-core/api/cup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { TeamLogo } from '../../components/TeamLogo';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';
import { dayTimeText, roundLabel } from './cupText';

export default function CupBracket({
  cup,
  mineId,
  now,
  onselect,
}: {
  cup: CupResponse;
  mineId: string | null;
  now: number;
  onselect: (m: CupMatch) => void;
}) {
  const c = useColors();
  const window = useWindowDimensions();
  const { motionOK } = useSnapshot(prefs);
  const horizontal = useRef<ScrollView>(null);
  const vertical = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const tree = cupBracket(cup.matches, active);
  const pending = useRef<{ column: number; node?: BracketNode } | null>(null);
  const own = tree.nodes.findLast(
    (n) => mineId && (n.homeTeamId === mineId || n.awayTeamId === mineId),
  );
  function jump(column: number, node?: BracketNode) {
    const target = Math.max(0, Math.min(tree.rounds.length - 1, column));
    if (motionOK)
      LayoutAnimation.configureNext({ duration: 400, update: { type: 'easeInEaseOut' } });
    pending.current = { column: target, ...(node ? { node } : {}) };
    if (target === active) movePending();
    else setActive(target);
  }
  function movePending() {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    const node = target.node
      ? tree.nodes.find((n) => n.round === target.node!.round && n.slot === target.node!.slot)
      : null;
    horizontal.current?.scrollTo({ x: target.column * B.column, animated: motionOK });
    vertical.current?.scrollTo({
      y: node ? Math.max(0, node.y - B.header) : 0,
      animated: motionOK,
    });
  }
  useEffect(() => {
    movePending();
  }, [active]);
  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, flexGrow: 1, paddingVertical: 2 }}
      >
        {tree.rounds.map((r, i) => (
          <Press
            key={r}
            accessibilityState={{ selected: i === active }}
            onPress={() => jump(i)}
            style={{
              flexGrow: 1,
              minHeight: 44,
              paddingHorizontal: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: i === active ? c.accent : c.line,
              backgroundColor: i === active ? alpha(c.accent, 0.12) : 'transparent',
            }}
          >
            <Txt v="sm" bold={i === active} tone={i === active ? 'accent' : 'muted'}>
              {roundLabel(r)}
            </Txt>
          </Press>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Txt v="xs" tone="muted" style={{ flex: 1 }}>
          {L.bracketHint}
        </Txt>
        {own ? (
          <Press
            onPress={() => jump(tree.rounds.indexOf(own.round), own)}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Txt v="sm" tone="accent" bold>
              {L.bracketMine}
            </Txt>
            <Txt v="sm" tone="accent" accessible={false}>
              ↗
            </Txt>
          </Press>
        ) : null}
      </View>
      <ScrollView
        horizontal
        ref={horizontal}
        nestedScrollEnabled
        style={{
          height: Math.min(window.height * 0.65, tree.viewportHeight),
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 12,
        }}
      >
        <ScrollView
          ref={vertical}
          nestedScrollEnabled
          style={{
            width: tree.width + 24,
            height: Math.min(window.height * 0.65, tree.viewportHeight),
          }}
        >
          <View style={{ width: tree.width, height: tree.height, margin: 12 }}>
            {tree.connectors.map((line, i) => (
              <Svg
                key={i}
                pointerEvents="none"
                accessible={false}
                width={line.width}
                height={line.height}
                viewBox={`${line.x} ${line.y} ${line.width} ${line.height}`}
                style={{ position: 'absolute', left: line.x, top: line.y }}
              >
                <Path d={line.path} fill="none" stroke={c.muted} strokeWidth={1.5} />
              </Svg>
            ))}
            {tree.rounds.map((r, i) => (
              <Txt key={r} bold style={{ position: 'absolute', left: i * B.column, top: 0 }}>
                {roundLabel(r)}
              </Txt>
            ))}
            {tree.nodes.map((n) => {
              const m = n.match;
              const mine = !!mineId && (n.homeTeamId === mineId || n.awayTeamId === mineId);
              const status = m
                ? m.played
                  ? L.matchFinished
                  : Date.parse(m.at) <= now
                    ? L.matchProcessing
                    : L.matchScheduled
                : L.bracketPending;
              return (
                <Press
                  key={`${n.round}:${n.slot}`}
                  disabled={!m}
                  onPress={() => m && onselect(m)}
                  accessibilityLabel={`${roundLabel(n.round)} · ${cup.teams.find((t) => t.teamId === n.homeTeamId)?.name ?? L.tbd} · ${cup.teams.find((t) => t.teamId === n.awayTeamId)?.name ?? L.tbd} · ${status}`}
                  style={{
                    position: 'absolute',
                    left: n.x,
                    top: n.y,
                    width: B.cardWidth,
                    height: n.height,
                    padding: n.compact ? 4 : 8,
                    gap: n.compact ? 2 : 4,
                    borderRadius: 10,
                    borderWidth: mine ? 2 : 1,
                    borderColor: mine ? c.accent : c.line,
                    backgroundColor: c.surface,
                  }}
                >
                  {!n.compact ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Txt v="xs" tone={m?.played ? 'good' : 'muted'}>
                        {status}
                      </Txt>
                      {mine ? (
                        <Txt v="xs" tone="accent">
                          {L.mineTag}
                        </Txt>
                      ) : null}
                    </View>
                  ) : null}
                  {[n.homeTeamId, n.awayTeamId].map((id, side) => {
                    const t = cup.teams.find((t) => t.teamId === id);
                    return (
                      <View
                        key={side}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <TeamLogo logo={t?.logo} name={t?.name ?? L.tbd} size={20} decorative />
                        <Txt
                          v="sm"
                          numberOfLines={1}
                          bold={!!id && m?.winnerTeamId === id}
                          tone={id && id === mineId ? 'accent' : 'ink'}
                          style={{ flex: 1 }}
                        >
                          {t?.name ?? L.tbd}
                        </Txt>
                        <Txt v="sm" bold>
                          {m?.played ? String(side === 0 ? m.homeGoals : m.awayGoals) : '–'}
                        </Txt>
                      </View>
                    );
                  })}
                  {!n.compact ? (
                    <Txt v="xs" tone="muted" numberOfLines={1}>
                      {m?.pens ? L.pens(m.pens) : m ? dayTimeText(m.at) : roundLabel(n.round)}
                    </Txt>
                  ) : null}
                </Press>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
