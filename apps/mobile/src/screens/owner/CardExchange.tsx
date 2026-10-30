// T-11-374 카드 바치기 과제(내 구단 화면 '카드 과제' 칸으로 연다, 웹 owner/CardExchange.svelte). 오늘의 과제 목록은 코드
// 묶음이라 부르지 않고, 열 때 내 팀(선수 목록 · 선발, 1분 메모)과 내 낸 횟수만 받는다. 과제를 고르면 선수를 고르고 확인한 뒤
// 낸다. 세 개를 모두 내면 보상.
// T-11-499 위 진행 띠에 오늘 낸 과제와 보상을 모으고, 과제마다 가치 낮은 선수로 추천 조합을 채워 '이 N명 내기' 한 번에 낸다.
// 고르기 화면은 낼 수 있는 선수만 가치 낮은 순으로 보이고 낼 수 없는 선수는 접는다. 낸 뒤에는 목록에 머문다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  fetchOwnerTeam,
  type OwnerTeamResponse,
  type TeamPlayer,
} from '@offside/app-core/api/team';
import { claimExchange, fetchExchangeMe } from '@offside/app-core/api/exchange';
import type { ExchangeMeResponse } from '@offside/contracts';
import {
  autoFill,
  canFinishAll,
  endsText,
  exchangeCardOf,
  exchangeChecklist,
  exchangeFitCount,
  exchangeLock,
  exchangeMet,
  exchangeName,
  exchangeRecommend,
  exchangesAt,
  rewardText,
  tierLabel,
  type ExchangeDef,
} from '@offside/app-core/exchange';
import { RADIUS } from '@offside/app-core/design-tokens';
import { lineupOf, marketName } from '@offside/app-core/market';
import { titleLabel } from '@offside/app-core/ownerTitle';
import { fmtValue } from '@offside/contracts/market-value';
import { POS_LABEL } from '@offside/game/pos-label';
import { tn } from '@offside/game/i18n/names';
import { localCareerNames } from '@offside/game/hof-store';
import { exchangeText as L } from '@offside/app-core/i18n/ko/exchange';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, DisclosureRow, Press, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';

const Check = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12l5 5L19 8"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export function CardExchange({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const [local] = useState(() => localCareerNames());
  const [now] = useState(() => Date.now());
  const [team, setTeam] = useState<OwnerTeamResponse | null>(null);
  const [claims, setClaims] = useState<Record<string, number>>({});
  const [reward, setReward] = useState<ExchangeMeResponse['reward']>([]);
  const [failed, setFailed] = useState(false);
  const [def, setDef] = useState<ExchangeDef | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  // 확인 화면. 취소하면 연 곳(목록 · 고르기)으로 돌아간다.
  const [confirm, setConfirm] = useState<'list' | 'pick' | null>(null);
  const [howTo, setHowTo] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<{ reward: string | null; titles: string[] } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [t, me] = await Promise.all([fetchOwnerTeam(), fetchExchangeMe()]);
    if (!t.ok || !me.ok) return setFailed(true);
    setTeam(t.data);
    setClaims(me.data.claims);
    setReward(me.data.reward);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const defs = useMemo(() => exchangesAt(new Date(now).toISOString()), [now]);
  const lineup = useMemo(() => (team ? lineupOf(team) : new Set<string>()), [team]);
  const players = useMemo(() => team?.players ?? [], [team]);
  const chosen = players.filter((p) => picked.includes(p.careerId));
  const cards = chosen.map(exchangeCardOf);
  const checks = def ? exchangeChecklist(def.rule, cards) : [];
  const ready = !!def && exchangeMet(def.rule, cards);
  const used = (d: ExchangeDef) => (claims[d.id] ?? 0) > 0;
  const doneCount = defs.filter(used).length;
  // 영입 · 잠김 · 판매 중 · 선발을 뺀, 오늘 낼 수 있는 선수. 남은 과제를 모두 채울 수 있는지 미리 알린다.
  const free = useMemo(
    () => players.filter((p) => !exchangeLock(p, lineup, { count: 0 })).map(exchangeCardOf),
    [players, lineup],
  );
  const left = useMemo(() => defs.filter((d) => !((claims[d.id] ?? 0) > 0)), [defs, claims]);
  const feasible = useMemo(() => canFinishAll(left, free), [left, free]);
  const recs = useMemo(() => exchangeRecommend(left, free), [left, free]);
  const open = def
    ? players
        .filter((p) => !exchangeLock(p, lineup, def.rule))
        .sort((a, b) => (a.cardValue ?? 0) - (b.cardValue ?? 0))
    : [];
  const shut = def ? players.filter((p) => !!exchangeLock(p, lineup, def.rule)) : [];
  const value = (ps: readonly { cardValue?: number | null | undefined }[]) =>
    fmtValue(ps.reduce((a, p) => a + (p.cardValue ?? 0), 0));
  const nameOf = (p: TeamPlayer) => marketName(p, local);
  const nameById = (id: string) => {
    const p = players.find((x) => x.careerId === id);
    return p ? nameOf(p) : '';
  };

  const pickTask = (d: ExchangeDef, ids: string[] = [], from: 'list' | null = null) => {
    setDef(d);
    setPicked(ids);
    setConfirm(from);
    setShowLocked(false);
    setError(null);
    setToast(null);
  };
  const cancel = () => {
    if (confirm === 'list') setDef(null);
    setConfirm(null);
  };
  const toggle = (p: TeamPlayer) =>
    setPicked((cur) =>
      cur.includes(p.careerId)
        ? cur.filter((id) => id !== p.careerId)
        : cur.length < (def?.rule.count ?? 0)
          ? [...cur, p.careerId]
          : cur,
    );
  const fill = () => {
    if (!def) return;
    const got = autoFill(def.rule, open.map(exchangeCardOf));
    setError(got ? null : L.autoFillNone);
    if (got) setPicked(got.map((x) => x.careerId));
  };
  const submit = async () => {
    if (!def || !ready) return;
    setBusy(true);
    setError(null);
    const r = await claimExchange(def.id, picked);
    setBusy(false);
    if (!r.ok) {
      // 고르기 화면으로 돌아가 이유와 고른 선수를 같이 보여 준다.
      setError(r.error.message || L.claimFail);
      setConfirm(null);
      return;
    }
    if (r.data.rewards.length || r.data.titles.length)
      setDone({
        reward: r.data.rewards.length ? rewardText(r.data.rewards) : null,
        titles: r.data.titles,
      });
    else
      setToast(
        L.doneToast({ name: exchangeName(def.key), left: Math.max(0, defs.length - r.data.done) }),
      );
    setDef(null);
    setPicked([]);
    setConfirm(null);
    void load();
  };

  const tierColor = (d: ExchangeDef) =>
    d.tier === 'hard' ? c.warn : d.tier === 'normal' ? c.ink : c.good;
  const tierTag = (d: ExchangeDef) => (
    <View
      style={{
        paddingHorizontal: 8,
        minHeight: 22,
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: c.surface2,
      }}
    >
      <Txt v="xs" bold style={{ color: tierColor(d) }}>
        {tierLabel(d.tier)}
      </Txt>
    </View>
  );
  const chip = (text: string, met = false, key?: string) => (
    <View
      key={key}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 26,
        paddingHorizontal: 9,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: met ? c.good : c.line,
        backgroundColor: c.surface2,
      }}
    >
      {met ? <Check color={c.good} size={12} /> : null}
      <Txt v="xs" style={{ color: met ? c.good : c.muted }}>
        {text}
      </Txt>
    </View>
  );
  const box = {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  } as const;
  const playerRow = (p: TeamPlayer, lock: string | null) => {
    const on = picked.includes(p.careerId);
    return (
      <Press
        key={p.careerId}
        testID={`exchange-player-${p.careerId}`}
        accessibilityRole="checkbox"
        accessibilityLabel={nameOf(p)}
        accessibilityState={{ checked: on, disabled: !!lock || busy }}
        disabled={!!lock || busy}
        onPress={() => toggle(p)}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 52,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: c.line,
            opacity: lock ? 0.5 : 1,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: lock ? c.muted : c.good,
              backgroundColor: on ? c.good : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {on ? <Check color={c.surface} /> : null}
          </View>
          <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
            <Txt bold>{nameOf(p)}</Txt>
            <Txt tone="muted" v="xs">
              {L.cardLine({ pos: tn(POS_LABEL[p.pos]), peak: p.peak })}
            </Txt>
          </View>
          {lock ? (
            <Txt tone="muted" v="xs">
              {lock}
            </Txt>
          ) : p.cardValue ? (
            <Txt style={{ fontFamily: DISPLAY[700] }}>{fmtValue(p.cardValue)}</Txt>
          ) : null}
        </View>
      </Press>
    );
  };

  return (
    <PopSheet
      label={L.title}
      step={confirm ? 'confirm' : (def?.id ?? (done ? 'done' : 'list'))}
      testID="card-exchange"
      onClose={onClose}
    >
      <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {def && !confirm ? (
            <Btn sm testID="exchange-back" accessibilityLabel={L.back} onPress={() => setDef(null)}>
              ‹
            </Btn>
          ) : null}
          <Txt v="h2" style={{ flex: 1 }} accessibilityRole="header">
            {def && !confirm ? exchangeName(def.key) : L.title}
          </Txt>
          {def && !confirm ? (
            tierTag(def)
          ) : !confirm ? (
            <Btn
              sm
              accessibilityLabel={L.howTo}
              testID="exchange-howto"
              onPress={() => setHowTo((v) => !v)}
            >
              ?
            </Btn>
          ) : null}
          <Btn sm testID="exchange-close" onPress={onClose}>
            {L.close}
          </Btn>
        </View>
        {done ? (
          <View
            testID="exchange-done"
            accessibilityLiveRegion="polite"
            style={{ gap: 10, padding: 16, borderRadius: RADIUS.md, backgroundColor: c.pitch }}
          >
            <Txt bold tone="onPitch" style={{ fontSize: rem(1.15) }}>
              {L.doneAllTitle}
            </Txt>
            {done.reward ? (
              <Txt bold tone="pitchAccent">
                {L.doneBody({ reward: done.reward })}
              </Txt>
            ) : null}
            {done.titles.map((t) => (
              <Txt key={t} tone="pitchAccent">
                {L.doneTitleEarned({ name: titleLabel(t) ?? t })}
              </Txt>
            ))}
            <Txt v="sm" tone="onPitch" style={{ opacity: 0.8 }}>
              {L.todayDone}
            </Txt>
            <Btn kind="primary" onPress={() => setDone(null)}>
              {L.ok}
            </Btn>
          </View>
        ) : failed ? (
          <>
            <Txt tone="bad">{L.loadFail}</Txt>
            <Btn onPress={() => void load()}>{L.retry}</Btn>
          </>
        ) : !team ? (
          <Txt tone="muted">{L.loading}</Txt>
        ) : confirm && def ? (
          <View style={{ gap: 12 }} testID="exchange-confirm">
            <Txt bold style={{ fontSize: rem(1.15) }}>
              {L.confirmTitle({ n: chosen.length })}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {chosen.map((p) => (
                <View
                  key={p.careerId}
                  style={{
                    flexGrow: 1,
                    flexBasis: 92,
                    gap: 2,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: c.line,
                    backgroundColor: c.surface2,
                  }}
                >
                  <Txt tone="accent" style={{ fontFamily: DISPLAY[700], fontSize: rem(1.2) }}>
                    {String(p.peak)}
                  </Txt>
                  <Txt v="sm" bold numberOfLines={1}>
                    {nameOf(p)}
                  </Txt>
                  <Txt v="xs" tone="muted">
                    {tn(POS_LABEL[p.pos])}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt v="sm">{L.confirmGone}</Txt>
            <Txt v="sm" tone="muted">
              {L.confirmFunds({ value: value(chosen) })}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: c.pitch,
              }}
            >
              <Txt tone="onPitch" style={{ fontFamily: DISPLAY[700], fontSize: rem(1.2) }}>
                {`${doneCount}/${defs.length}`}
              </Txt>
              <Txt tone="onPitch" accessible={false}>
                →
              </Txt>
              <Txt tone="pitchAccent" style={{ fontFamily: DISPLAY[700], fontSize: rem(1.2) }}>
                {`${doneCount + 1}/${defs.length}`}
              </Txt>
              <Txt v="xs" tone="onPitch" style={{ flex: 1, textAlign: 'right', opacity: 0.85 }}>
                {doneCount + 1 >= defs.length
                  ? L.confirmLast
                  : L.confirmMore({ left: defs.length - doneCount - 1 })}
              </Txt>
            </View>
            {error ? <Txt tone="bad">{error}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn block disabled={busy} onPress={cancel}>
                  {L.cancel}
                </Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  block
                  kind="danger"
                  testID="exchange-confirm-ok"
                  disabled={busy}
                  onPress={() => void submit()}
                >
                  {L.confirmOk({ n: chosen.length })}
                </Btn>
              </View>
            </View>
          </View>
        ) : !def ? (
          <>
            {howTo ? (
              <Txt tone="muted" v="sm">
                {L.lead}
              </Txt>
            ) : null}
            <View
              testID="exchange-today"
              style={{ gap: 12, padding: 16, borderRadius: RADIUS.md, backgroundColor: c.pitch }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Txt v="eyebrow" tone="onPitch" style={{ opacity: 0.75 }}>
                  {L.todayTitle}
                </Txt>
                <Txt v="xs" tone="onPitch" style={{ opacity: 0.75 }}>
                  {endsText(defs[0]!, now)}
                </Txt>
              </View>
              <View
                accessible
                accessibilityLabel={L.trackAria({ done: doneCount, total: defs.length })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: 2,
                    marginTop: -1,
                    backgroundColor: c.chalk,
                  }}
                />
                {defs.map((d, i) => (
                  <View
                    key={d.id}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      borderWidth: 2,
                      borderColor: used(d) ? c.pitchAccent : c.chalk,
                      backgroundColor: used(d) ? c.pitchAccent : c.pitch,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {used(d) ? (
                      <Check color={c.pitch} />
                    ) : (
                      <Txt tone="onPitch" style={{ fontFamily: DISPLAY[700] }}>
                        {String(i + 1)}
                      </Txt>
                    )}
                  </View>
                ))}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: c.pitchAccent,
                    backgroundColor: c.pitch,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Rect
                      x={3}
                      y={9}
                      width={18}
                      height={12}
                      rx={2}
                      stroke={c.pitchAccent}
                      strokeWidth={2}
                    />
                    <Path
                      d="M3 13h18M12 9v12M7.5 9C6 9 5 8 5 6.5S6.5 4 8 5l4 4 4-4c1.5-1 3 0 3 1.5S18 9 16.5 9"
                      stroke={c.pitchAccent}
                      strokeWidth={2}
                    />
                  </Svg>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: 12,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Txt
                    tone="onPitch"
                    style={{ fontFamily: DISPLAY[700], fontSize: rem(1.9), lineHeight: rem(1.9) }}
                  >
                    {`${doneCount} / ${defs.length}`}
                  </Txt>
                  <Txt v="xs" tone="onPitch" style={{ opacity: 0.75 }}>
                    {L.todayCount}
                  </Txt>
                </View>
                <View style={{ gap: 2, alignItems: 'flex-end', flexShrink: 1 }}>
                  <Txt v="xs" tone="onPitch" style={{ opacity: 0.75 }}>
                    {L.rewardAll}
                  </Txt>
                  <Txt v="sm" bold tone="pitchAccent" style={{ textAlign: 'right' }}>
                    {rewardText(reward)}
                  </Txt>
                </View>
              </View>
              {doneCount === defs.length ? (
                <Txt v="sm" tone="onPitch">
                  {L.todayDone}
                </Txt>
              ) : !feasible ? (
                <Txt v="sm" tone="pitchAccent" testID="exchange-cant">
                  {L.cantFinish}
                </Txt>
              ) : null}
            </View>
            {toast ? (
              <View
                testID="exchange-toast"
                accessibilityLiveRegion="polite"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: RADIUS.md,
                  backgroundColor: c.surface2,
                }}
              >
                <Check color={c.good} />
                <Txt v="sm" tone="good" style={{ flex: 1 }}>
                  {toast}
                </Txt>
              </View>
            ) : null}
            {defs.map((d) => {
              const rec = recs.get(d.id);
              if (used(d))
                return (
                  <View
                    key={d.id}
                    testID={`exchange-${d.tier}`}
                    style={[
                      box,
                      {
                        padding: 14,
                        opacity: 0.65,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      },
                    ]}
                  >
                    {tierTag(d)}
                    <Txt bold style={{ flex: 1 }}>
                      {exchangeName(d.key)}
                    </Txt>
                    <Check color={c.good} />
                    <Txt v="sm" tone="good">
                      {L.taskDone}
                    </Txt>
                  </View>
                );
              return (
                <View
                  key={d.id}
                  testID={`exchange-${d.tier}`}
                  style={[box, { padding: 14, gap: 10 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {tierTag(d)}
                    <Txt bold style={{ flex: 1 }}>
                      {exchangeName(d.key)}
                    </Txt>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {exchangeChecklist(d.rule, []).map((x) => chip(x.text, false, x.condition))}
                  </View>
                  {rec ? (
                    <>
                      <View
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                        testID="exchange-rec"
                      >
                        {rec.map((x) => (
                          <View
                            key={x.careerId}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              minHeight: 30,
                              paddingLeft: 4,
                              paddingRight: 10,
                              borderRadius: RADIUS.pill,
                              borderWidth: 1,
                              borderColor: c.line,
                              backgroundColor: c.surface2,
                            }}
                          >
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: c.bg,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Txt v="xs" tone="accent" style={{ fontFamily: DISPLAY[700] }}>
                                {String(x.peak)}
                              </Txt>
                            </View>
                            <Txt v="sm">{nameById(x.careerId)}</Txt>
                          </View>
                        ))}
                      </View>
                      <Txt v="xs" tone="muted">
                        {L.recommendNote({ value: value(rec) })}
                      </Txt>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Btn
                          testID="exchange-change"
                          onPress={() =>
                            pickTask(
                              d,
                              rec.map((x) => x.careerId),
                            )
                          }
                        >
                          {L.change}
                        </Btn>
                        <View style={{ flex: 1 }}>
                          <Btn
                            block
                            kind="primary"
                            testID="exchange-quick"
                            disabled={busy}
                            onPress={() =>
                              pickTask(
                                d,
                                rec.map((x) => x.careerId),
                                'list',
                              )
                            }
                          >
                            {L.submitThese({ n: rec.length })}
                          </Btn>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <Txt v="sm" tone="bad" testID="exchange-short">
                        {`${L.cantTask} · ${L.fitCount({ n: exchangeFitCount(d.rule, free) })}`}
                      </Txt>
                      <Btn testID="exchange-open" onPress={() => pickTask(d)}>
                        {L.pick}
                      </Btn>
                    </>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
              testID="exchange-checks"
            >
              {checks.map((x) => chip(x.text, x.met, x.condition))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Txt v="eyebrow" style={{ flexShrink: 1 }}>
                {L.canList({ n: open.length })}
              </Txt>
              <Btn sm kind="ghost" testID="exchange-fill" disabled={busy} onPress={fill}>
                {L.autoFill}
              </Btn>
            </View>
            {error ? <Txt tone="bad">{error}</Txt> : null}
            <View>
              {open.length ? (
                open.map((p) => playerRow(p, null))
              ) : (
                <Txt tone="muted">{L.noCards}</Txt>
              )}
              {shut.length ? (
                <>
                  <DisclosureRow
                    open={showLocked}
                    onToggle={() => setShowLocked((v) => !v)}
                    label={L.lockedList({ n: shut.length })}
                    testID="exchange-locked"
                  />
                  {showLocked
                    ? shut.map((p) => playerRow(p, exchangeLock(p, lineup, def.rule)))
                    : null}
                </>
              ) : null}
            </View>
            <View
              style={{ gap: 8, padding: 12, borderRadius: RADIUS.md, backgroundColor: c.surface2 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Txt v="sm" bold testID="exchange-picked">
                  {L.picked({ n: picked.length, need: def.rule.count })}
                </Txt>
                <Txt v="sm" tone="muted">
                  {L.lostValue({ value: value(chosen) })}
                </Txt>
              </View>
              <Btn
                block
                kind="primary"
                testID="exchange-submit"
                disabled={!ready || busy}
                onPress={() => setConfirm('pick')}
              >
                {L.submitN({ n: def.rule.count })}
              </Btn>
            </View>
          </>
        )}
      </View>
    </PopSheet>
  );
}
