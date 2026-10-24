// T-11-374 카드 바치기 과제(내 구단 화면 '카드 과제' 칸으로 연다, 웹 owner/CardExchange.svelte). 오늘의 과제 목록은 코드
// 묶음이라 부르지 않고, 열 때 내 팀(선수 목록 · 선발, 1분 메모)과 내 낸 횟수만 받는다. 과제를 고르면 선수를 고르고 확인한 뒤
// 낸다. 세 개를 모두 내면 보상.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
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
  exchangeLock,
  exchangeMet,
  exchangeName,
  exchangesAt,
  rewardText,
  tierLabel,
  type ExchangeDef,
} from '@offside/app-core/exchange';
import { lineupOf, marketName } from '@offside/app-core/market';
import { titleLabel } from '@offside/app-core/ownerTitle';
import { fmtValue } from '@offside/contracts/market-value';
import { POS_LABEL } from '@offside/game/pos-label';
import { tn } from '@offside/game/i18n/names';
import { localCareerNames } from '@offside/game/hof-store';
import { exchangeText as L } from '@offside/app-core/i18n/ko/exchange';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Card, Pill, Press, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    reward: string | null;
    done: number;
    titles: string[];
  } | null>(null);

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
  const players = team?.players ?? [];
  const chosen = players.filter((p) => picked.includes(p.careerId));
  const cards = chosen.map(exchangeCardOf);
  const checks = def ? exchangeChecklist(def.rule, cards) : [];
  const ready = !!def && exchangeMet(def.rule, cards);
  const used = (d: ExchangeDef) => (claims[d.id] ?? 0) > 0;
  const doneCount = defs.filter(used).length;
  // 영입 · 잠김 · 판매 중 · 선발을 뺀, 오늘 낼 수 있는 선수. 남은 과제를 모두 채울 수 있는지 미리 알린다.
  const feasible = useMemo(
    () =>
      canFinishAll(
        defs.filter((d) => !((claims[d.id] ?? 0) > 0)),
        (team?.players ?? [])
          .filter((p) => !exchangeLock(p, lineup, { count: 0 }))
          .map(exchangeCardOf),
      ),
    [defs, claims, team, lineup],
  );
  const nameOf = (p: TeamPlayer) => marketName(p, local);

  const open = (d: ExchangeDef) => {
    setDef(d);
    setPicked([]);
    setError(null);
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
    const rule = def.rule;
    const got = autoFill(
      rule,
      players.filter((p) => !exchangeLock(p, lineup, rule)).map(exchangeCardOf),
    );
    setError(got ? null : L.autoFillNone);
    if (got) setPicked(got.map((x) => x.careerId));
  };
  const submit = async () => {
    if (!def || !ready) return;
    setBusy(true);
    setError(null);
    const r = await claimExchange(def.id, picked);
    setBusy(false);
    if (!r.ok) return setError(r.error.message || L.claimFail);
    setDone({
      reward: r.data.rewards.length ? rewardText(r.data.rewards) : null,
      done: r.data.done,
      titles: r.data.titles,
    });
    setDef(null);
    setPicked([]);
    void load();
  };
  const askSubmit = () => {
    const value = chosen.reduce((a, p) => a + (p.cardValue ?? 0), 0);
    Alert.alert(
      L.confirmTitle,
      [
        L.confirmBody({ n: chosen.length }),
        L.confirmRaised({ n: chosen.length }),
        L.confirmValue({ value: fmtValue(value) }),
        doneCount + 1 >= defs.length
          ? L.confirmLast
          : L.confirmLeft({ left: defs.length - doneCount - 1 }),
      ]
        .filter(Boolean)
        .join('\n\n'),
      [
        { text: L.cancel, style: 'cancel' },
        { text: L.confirmOk, style: 'destructive', onPress: () => void submit() },
      ],
    );
  };

  return (
    <PopSheet
      label={L.title}
      step={def?.id ?? (done ? 'done' : 'list')}
      testID="card-exchange"
      onClose={onClose}
    >
      <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {def ? (
            <Btn sm testID="exchange-back" onPress={() => setDef(null)}>
              {`‹ ${L.back}`}
            </Btn>
          ) : null}
          <Txt v="h2" style={{ flex: 1 }} accessibilityRole="header">
            {def ? exchangeName(def.key) : L.title}
          </Txt>
          <Btn sm testID="exchange-close" onPress={onClose}>
            {L.close}
          </Btn>
        </View>
        {done ? (
          <Card gap={8} testID="exchange-done">
            <Txt bold>{done.reward ? L.doneAllTitle : L.doneTitle}</Txt>
            <Txt>
              {done.reward
                ? L.doneBody({ reward: done.reward })
                : L.doneProgress({ done: done.done, total: defs.length })}
            </Txt>
            {done.titles.map((t) => (
              <Txt key={t} tone="good">
                {L.doneTitleEarned({ name: titleLabel(t) ?? t })}
              </Txt>
            ))}
            <Btn onPress={() => setDone(null)}>{L.ok}</Btn>
          </Card>
        ) : failed ? (
          <>
            <Txt tone="bad">{L.loadFail}</Txt>
            <Btn onPress={() => void load()}>{L.retry}</Btn>
          </>
        ) : !team ? (
          <Txt tone="muted">{L.loading}</Txt>
        ) : !def ? (
          <>
            <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
              {L.lead}
            </Txt>
            <Card gap={4} testID="exchange-today">
              <Txt bold>{L.progress({ done: doneCount, total: defs.length })}</Txt>
              <Txt style={{ fontSize: rem(0.875) }}>{`${L.rewardAll} ${rewardText(reward)}`}</Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                {endsText(defs[0]!, now)}
              </Txt>
              {doneCount === defs.length ? (
                <Txt tone="good" style={{ fontSize: rem(0.875) }}>
                  {L.todayDone}
                </Txt>
              ) : !feasible ? (
                <Txt tone="bad" style={{ fontSize: rem(0.875) }} testID="exchange-cant">
                  {L.cantFinish}
                </Txt>
              ) : null}
            </Card>
            {defs.map((d) => {
              const off = used(d);
              return (
                <Press
                  key={d.id}
                  testID={`exchange-${d.tier}`}
                  disabled={off}
                  onPress={() => open(d)}
                  scale={0.98}
                >
                  <Card gap={4} style={{ opacity: off ? 0.55 : 1 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <Pill tone={d.tier === 'hard' ? 'warn' : 'good'}>{tierLabel(d.tier)}</Pill>
                    </View>
                    <Txt bold>{exchangeName(d.key)}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                      {exchangeChecklist(d.rule, [])
                        .map((x) => x.text)
                        .join(' · ')}
                    </Txt>
                    {off ? (
                      <Txt tone="good" style={{ fontSize: rem(0.875) }}>
                        {L.taskDone}
                      </Txt>
                    ) : null}
                  </Card>
                </Press>
              );
            })}
          </>
        ) : (
          <>
            <View style={{ gap: 4 }} testID="exchange-checks">
              {checks.map((x) => (
                <Txt key={x.condition} tone={x.met ? 'good' : 'muted'}>
                  {`${x.met ? '✓' : '·'} ${x.text}`}
                </Txt>
              ))}
            </View>
            <Txt style={{ fontSize: rem(0.875) }}>{`${L.rewardAll} ${rewardText(reward)}`}</Txt>
            <Txt bold testID="exchange-picked">
              {L.picked({ n: picked.length, need: def.rule.count })}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn sm testID="exchange-fill" disabled={busy} onPress={fill}>
                {L.autoFill}
              </Btn>
              <Btn sm disabled={busy || !picked.length} onPress={() => setPicked([])}>
                {L.clear}
              </Btn>
            </View>
            {error ? <Txt tone="bad">{error}</Txt> : null}
            {players.length ? (
              players.map((p) => {
                const lock = exchangeLock(p, lineup, def.rule);
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
                        minHeight: 44,
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
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: lock ? c.muted : c.good,
                          backgroundColor: on ? c.good : 'transparent',
                        }}
                      />
                      <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
                        <Txt bold>{nameOf(p)}</Txt>
                        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                          {L.cardLine({ pos: tn(POS_LABEL[p.pos]), peak: p.peak })}
                        </Txt>
                      </View>
                      <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                        {lock ?? (p.cardValue ? fmtValue(p.cardValue) : '')}
                      </Txt>
                    </View>
                  </Press>
                );
              })
            ) : (
              <Txt tone="muted">{L.noCards}</Txt>
            )}
            <Btn
              block
              kind="primary"
              testID="exchange-submit"
              disabled={!ready || busy}
              onPress={askSubmit}
            >
              {L.submit}
            </Btn>
          </>
        )}
      </View>
    </PopSheet>
  );
}
