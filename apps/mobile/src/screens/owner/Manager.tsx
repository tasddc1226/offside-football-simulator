// T-11-310 감독 커리어(웹 Manager.svelte) — 구단주 화면의 '감독 커리어' 카드로 연다. 지금 가진 선수 카드로 감독 커리어를
// 시작하고(한 번에 하나), 기기에서 시즌을 돌린 뒤 감독 카드로 확정해 우리 팀 감독 칸에 앉힌다. 화면을 열 때 목록을 한 번 받는다.
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import type { ManagerCandidate, ManagerCareer, ManagersResponse } from '@offside/contracts';
import { FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
import type { ManagerStyle } from '@offside/contracts/manager-rules';
import {
  MANAGER_STYLES,
  acceptOffer,
  answerEvent,
  boardMinimum,
  closeEvents,
  continueAfterResult,
  currentEvent,
  endingDesc,
  endingName,
  leagueName,
  managerEventText,
  managerResult,
  masteryGrade,
  pickTransfer,
  restSeason,
  setupSeason,
  specialDesc,
  specialName,
  stayAtClub,
  styleDesc,
  styleName,
  targetName,
  targetOptions,
  transferDesc,
  transferName,
  type BoardTarget,
  type ManagerState,
} from '@offside/game/manager';
import { tn } from '@offside/game/i18n/names';
import { POS_LABEL } from '@offside/game/pos-label';
import { localCareerNames } from '@offside/game/hof-store';
import {
  abandonManager,
  clearManagerState,
  coachEffectText,
  fetchManagers,
  finishManager,
  loadManagerState,
  managerName,
  saveManagerState,
  setTeamCoach,
  startConfirmLines,
  startManager,
} from '@offside/app-core/manager';
import { managerText as M } from '@offside/app-core/i18n/ko/manager';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Opt, Press, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { LoginButtons } from './LoginButtons';

type CardRules = {
  mastery: Record<FormationId, string>;
  style: ManagerStyle;
  specials: readonly ('wing' | 'midfield' | 'defense' | 'counter' | 'youth')[];
};
const RANK: Record<string, number> = { S: 3, A: 2, B: 1, C: 0 };
const bestFormation = (m: CardRules): FormationId =>
  FORMATION_IDS.reduce((a, f) => (RANK[m.mastery[f]!]! > RANK[m.mastery[a]!]! ? f : a));
const small = { fontSize: rem(0.875) } as const;
const tiny = { fontSize: rem(0.75) } as const;

/** 감독 카드 몸통(숙련 · 성향 · 특기 · 감독 칸 효과). */
function CardBody({ r }: { r: CardRules }) {
  const f = bestFormation(r);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {FORMATION_IDS.map((x) => (
          <Chip key={x} title={x} sub={M.mastery({ grade: r.mastery[x]! })} />
        ))}
      </View>
      <Txt style={small}>
        {`${M.style} ${styleName(r.style)} · ${M.specials} ${
          r.specials.length ? r.specials.map(specialName).join(' · ') : M.noSpecials
        }`}
      </Txt>
      {r.specials.map((k) => (
        <Txt key={k} tone="muted" style={tiny}>{`${specialName(k)}: ${specialDesc(k)}`}</Txt>
      ))}
      <Txt style={small}>
        {`${M.effect} (${M.effectFor({ formation: f })}) ${coachEffectText(r as never, f)}`}
      </Txt>
    </View>
  );
}

function Chip({ title, sub }: { title: string; sub?: string | undefined }) {
  const c = useColors();
  return (
    <View
      style={{
        alignItems: 'center',
        minWidth: 56,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Txt bold style={small}>
        {title}
      </Txt>
      {sub ? (
        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

function Row({
  title,
  sub,
  note,
  action,
}: {
  title: string;
  sub?: string;
  note?: string;
  action?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt bold>{title}</Txt>
        {sub ? <Txt style={tiny}>{sub}</Txt> : null}
        {note ? (
          <Txt tone="muted" style={tiny}>
            {note}
          </Txt>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export default function Manager() {
  const c = useColors();
  const local = useMemo(() => localCareerNames(), []);
  const [data, setData] = useState<ManagersResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loginNeeded, setLoginNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [st, setSt] = useState<ManagerState | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const [pick, setPick] = useState<{
    formation: FormationId;
    style: ManagerStyle;
    target: BoardTarget;
  }>({ formation: '4-3-3', style: 'balance', target: 'mid' });
  const [retryN, setRetryN] = useState(0);
  const { tick, track } = useRefresh();

  const nameOf = (m: Pick<ManagerCareer, 'careerId' | 'publicName' | 'number' | 'origin'>) =>
    managerName(
      { careerId: m.careerId, publicName: m.publicName, number: m.number, pos: m.origin.pos },
      local,
    );
  const resetPick = (s: ManagerState) =>
    setPick({ formation: s.formation, style: s.style, target: boardMinimum(s) });

  async function load() {
    setFailed(false);
    const r = await track(fetchManagers());
    if (!r.ok) {
      const login =
        r.error.reason === 'GOOGLE_LOGIN_REQUIRED' || r.error.code === 'PROFILE_REQUIRED';
      setLoginNeeded(login);
      setFailed(!login);
      return;
    }
    setLoginNeeded(false);
    setData(r.data);
    const s = r.data.active ? loadManagerState(r.data.active, nameOf(r.data.active)) : null;
    setSt(s);
    if (s) resetPick(s);
  }
  useEffect(() => {
    void load();
  }, [tick, retryN]);

  /** 엔진 함수로 상태를 바꾸고 저장한다(새 객체로 다시 넣어 화면을 그린다). */
  function act(fn: (s: ManagerState) => unknown) {
    if (!st) return;
    fn(st);
    saveManagerState(st);
    if (st.phase === 'setup') resetPick(st);
    setSt({ ...st });
  }
  async function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.error?.message ?? M.loadFail);
    return r.ok;
  }
  const askStart = (cand: ManagerCandidate) =>
    Alert.alert(
      M.confirmTitle({ name: managerName(cand, local) }),
      startConfirmLines(cand)
        .map((l) => `· ${l}`)
        .join('\n'),
      [
        { text: M.cancel, style: 'cancel' },
        {
          text: M.confirmOk,
          onPress: () =>
            void run(() => startManager(cand.careerId)).then((ok) => ok && void load()),
        },
      ],
    );
  const askAbandon = () =>
    Alert.alert(M.abandon, M.abandonConfirm, [
      { text: M.cancel, style: 'cancel' },
      {
        text: M.abandonOk,
        style: 'destructive',
        onPress: () => {
          if (!st) return;
          const id = st.id;
          void run(() => abandonManager(id)).then((ok) => {
            if (!ok) return;
            clearManagerState();
            void load();
          });
        },
      },
    ]);
  async function finish() {
    const res = st && managerResult(st);
    if (!st || !res) return;
    const id = st.id;
    if (await run(() => finishManager(id, res))) {
      clearManagerState();
      await load();
    }
  }
  async function seat(id: string | null) {
    if (await run(() => setTeamCoach(id))) await load();
  }

  const ev = st && st.phase === 'event' ? currentEvent(st) : null;
  const shownEv = st && answered ? (st.events.find((e) => e.id === answered) ?? null) : ev;
  const lastSeason = st?.history.at(-1) ?? null;
  const result = st && st.phase === 'done' ? managerResult(st) : null;
  const targets = st && st.phase === 'setup' ? targetOptions(st) : [];
  const minTarget = st && st.phase === 'setup' ? boardMinimum(st) : null;
  const errLine = error ? (
    <Txt tone="bad" bold accessibilityRole="alert">
      {error}
    </Txt>
  ) : null;

  const play =
    st && data?.active ? (
      <>
        <Card gap={10} testID={`manager-play-${st.phase}`}>
          <View style={{ gap: 2 }}>
            <Txt v="h2">{nameOf(data.active)}</Txt>
            <Txt tone="muted" style={small}>
              {M.progress({
                season: Math.min(st.season + (st.phase === 'done' ? 0 : 1), st.seasonsTotal),
                total: st.seasonsTotal,
                age: st.age,
              })}
            </Txt>
            <Txt style={small}>
              {st.club ? `${tn(st.club.name)} · ${leagueName(st.club.leagueId)}` : M.noClub}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(
              [
                [M.statFame, st.fame],
                [M.statTrust, st.trust],
                [M.statMorale, st.morale],
                [M.statFans, st.fans],
                [M.statControl, st.control],
                [M.statAdapt, st.adapt],
              ] as const
            ).map(([k, v]) => (
              <View
                key={k}
                style={{
                  width: '31.5%',
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: c.surface2,
                }}
              >
                <Txt tone="muted" style={tiny}>
                  {k}
                </Txt>
                <Txt bold num>
                  {String(v)}
                </Txt>
              </View>
            ))}
          </View>
          <Txt tone="muted" style={small}>
            {`${M.record({ w: st.wins, d: st.draws, l: st.losses })} · ${M.honors({
              titles: st.titles,
              cups: st.cups,
              promotions: st.promotions,
            })}`}
          </Txt>
          {st.log.map((line, i) => (
            <Txt key={i} style={small}>
              {line}
            </Txt>
          ))}
        </Card>

        {st.phase === 'offers' ? (
          <Card gap={10} testID="manager-offers">
            <Txt v="h2">{M.offersHeading}</Txt>
            {st.offers.length ? (
              <>
                <Txt tone="muted" style={small}>
                  {M.offersLead}
                </Txt>
                {st.offers.map((o, i) => (
                  <Row
                    key={o.clubId}
                    title={tn(o.name)}
                    sub={leagueName(o.leagueId)}
                    action={
                      <Btn
                        sm
                        kind="primary"
                        testID="manager-accept"
                        onPress={() => act((s) => acceptOffer(s, i))}
                      >
                        {M.accept}
                      </Btn>
                    }
                  />
                ))}
                {st.club ? (
                  <Btn testID="manager-stay" onPress={() => act(stayAtClub)}>
                    {M.stay}
                  </Btn>
                ) : null}
              </>
            ) : (
              <>
                <Txt tone="muted" style={small}>
                  {M.restLead}
                </Txt>
                <Btn testID="manager-rest" onPress={() => act(restSeason)}>
                  {M.rest}
                </Btn>
              </>
            )}
          </Card>
        ) : st.phase === 'setup' ? (
          <Card gap={10} testID="manager-setup">
            <Txt v="h2">{M.setupHeading}</Txt>
            <Txt tone="muted" bold style={tiny}>
              {M.formation}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {FORMATION_IDS.map((f) => (
                <Opt
                  key={f}
                  style={{ flex: 1, alignItems: 'center' }}
                  selected={pick.formation === f}
                  onPress={() => setPick((p) => ({ ...p, formation: f }))}
                >
                  <Txt bold>{f}</Txt>
                  <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                    {M.mastery({ grade: masteryGrade(st.masteryXp[f]) })}
                  </Txt>
                </Opt>
              ))}
            </View>
            <Txt tone="muted" bold style={tiny}>
              {M.style}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {MANAGER_STYLES.map((k) => (
                <Opt
                  key={k}
                  style={{ flex: 1, alignItems: 'center' }}
                  selected={pick.style === k}
                  onPress={() => setPick((p) => ({ ...p, style: k }))}
                >
                  <Txt bold>{styleName(k)}</Txt>
                </Opt>
              ))}
            </View>
            <Txt tone="muted" style={small}>
              {styleDesc(pick.style)}
            </Txt>
            <Txt tone="muted" bold style={tiny}>
              {M.target}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {targets.map((t) => (
                <Opt
                  key={t}
                  style={{ minWidth: 72, alignItems: 'center' }}
                  selected={pick.target === t}
                  onPress={() => setPick((p) => ({ ...p, target: t }))}
                >
                  <Txt bold>{targetName(t)}</Txt>
                  {t === minTarget ? (
                    <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                      {M.targetMin}
                    </Txt>
                  ) : null}
                </Opt>
              ))}
            </View>
            <Txt tone="muted" style={small}>
              {M.targetLead}
            </Txt>
            <Btn
              block
              kind="primary"
              testID="manager-season"
              onPress={() => act((s) => setupSeason(s, pick))}
            >
              {M.startSeason}
            </Btn>
          </Card>
        ) : st.phase === 'transfer' ? (
          <Card gap={10} testID="manager-transfer">
            <Txt v="h2">{M.transferHeading}</Txt>
            <Txt tone="muted" style={small}>
              {M.transferLead}
            </Txt>
            {st.transfers.map((t, i) => (
              <Press
                key={i}
                testID="manager-transfer-pick"
                onPress={() => act((s) => pickTransfer(s, i))}
                scale={0.98}
              >
                <Row
                  title={transferName(t.kind)}
                  sub={M.transferSpec({ pos: tn(POS_LABEL[t.pos]), ovr: t.ovr, age: t.age })}
                  note={transferDesc(t.kind)}
                  action={<Txt tone="muted">›</Txt>}
                />
              </Press>
            ))}
            <Btn testID="manager-skip" onPress={() => act((s) => pickTransfer(s, -1))}>
              {M.skip}
            </Btn>
          </Card>
        ) : st.phase === 'event' ? (
          <Card gap={10} testID="manager-event">
            {shownEv ? (
              (() => {
                const t = managerEventText(shownEv.id);
                return (
                  <>
                    <Txt v="eyebrow">
                      {M.eventHeading({
                        n: st.events.indexOf(shownEv) + 1,
                        total: st.events.length,
                      })}
                    </Txt>
                    <Txt v="h2">{t.t}</Txt>
                    <Txt>{t.b}</Txt>
                    {shownEv.result !== null ? (
                      <>
                        <View
                          style={{ padding: 12, borderRadius: 10, backgroundColor: c.surface2 }}
                        >
                          <Txt testID="manager-event-result">{shownEv.result}</Txt>
                        </View>
                        <Btn
                          block
                          kind="primary"
                          testID="manager-next"
                          onPress={() => setAnswered(null)}
                        >
                          {M.next}
                        </Btn>
                      </>
                    ) : (
                      t.choices.map((label, i) => (
                        <Btn
                          key={i}
                          block
                          testID="manager-choice"
                          onPress={() =>
                            act((s) => {
                              setAnswered(shownEv.id);
                              answerEvent(s, i);
                            })
                          }
                        >
                          {label}
                        </Btn>
                      ))
                    )}
                  </>
                );
              })()
            ) : (
              <Btn block kind="primary" testID="manager-result" onPress={() => act(closeEvents)}>
                {M.toResult}
              </Btn>
            )}
          </Card>
        ) : st.phase === 'result' && lastSeason ? (
          <Card gap={10} testID="manager-result-card">
            <Txt v="h2">{M.resultHeading({ n: lastSeason.n })}</Txt>
            {lastSeason.clubId ? (
              <Txt tone="muted" style={small}>
                {M.record({ w: lastSeason.w, d: lastSeason.d, l: lastSeason.l })}
              </Txt>
            ) : null}
            {lastSeason.lines.map((line, i) => (
              <Txt key={i} style={small}>
                {line}
              </Txt>
            ))}
            <Btn
              block
              kind="primary"
              testID="manager-continue"
              onPress={() => act(continueAfterResult)}
            >
              {M.nextSeason}
            </Btn>
          </Card>
        ) : st.phase === 'done' && result ? (
          <Card gap={10} testID="manager-done">
            <Txt v="h2">{M.doneHeading}</Txt>
            <View
              style={{ gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line }}
            >
              <Txt bold tone="accent">
                {M.grade({ grade: result.grade })}
              </Txt>
              <Txt bold>{endingName(result.ending)}</Txt>
              <Txt tone="muted" style={small}>
                {endingDesc(result.ending)}
              </Txt>
              <CardBody r={result} />
            </View>
            <Txt tone="muted" style={small}>
              {M.doneLead}
            </Txt>
            {errLine}
            <Btn
              block
              kind="primary"
              testID="manager-finish"
              disabled={busy}
              onPress={() => void finish()}
            >
              {M.finish}
            </Btn>
          </Card>
        ) : null}

        {st.history.length ? (
          <Card gap={4} testID="manager-history">
            <Txt v="h2">{M.history}</Txt>
            {st.history.map((h) => (
              <Txt key={h.n} style={small}>
                {h.clubId && h.club
                  ? M.historyRow({ n: h.n, club: tn(h.club), rank: h.rank, teams: h.teams })
                  : M.historyRest({ n: h.n })}
              </Txt>
            ))}
          </Card>
        ) : null}
        {st.phase !== 'done' ? (
          <Btn kind="danger" testID="manager-abandon" onPress={askAbandon}>
            {M.abandon}
          </Btn>
        ) : null}
      </>
    ) : null;

  return (
    <Screen>
      <Topbar />
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Txt v="eyebrow">{M.eyebrow}</Txt>
        <Txt v="h1" accessibilityRole="header">
          {M.title}
        </Txt>
      </View>

      {loginNeeded ? (
        <Card gap={10}>
          <Txt tone="muted">{M.loginNeeded}</Txt>
          <LoginButtons />
        </Card>
      ) : failed && !data ? (
        <Card gap={10}>
          <Txt tone="muted">{M.loadFail}</Txt>
          <Btn sm onPress={() => setRetryN((n) => n + 1)}>
            {M.retry}
          </Btn>
        </Card>
      ) : !data ? (
        <Card>
          <Txt tone="muted">{M.loading}</Txt>
        </Card>
      ) : (
        <>
          {play ?? (
            <Card gap={10} testID="manager-start">
              <Txt v="h2">{M.startHeading}</Txt>
              <Txt tone="muted" style={small}>
                {M.startLead}
              </Txt>
              {data.candidates.length ? (
                data.candidates.map((cand) => (
                  <Row
                    key={cand.careerId}
                    title={managerName(cand, local)}
                    sub={`${tn(POS_LABEL[cand.pos])} · OVR ${cand.peak}${
                      cand.inLineup ? ` · ${M.inLineup}` : ''
                    }${cand.listed ? ` · ${M.listed}` : ''}`}
                    action={
                      <Btn sm testID="manager-pick" disabled={busy} onPress={() => askStart(cand)}>
                        {M.pick}
                      </Btn>
                    }
                  />
                ))
              ) : (
                <Txt tone="muted" style={small} testID="manager-empty">
                  {M.noCandidates}
                </Txt>
              )}
              {errLine}
            </Card>
          )}

          <Card gap={10} testID="manager-list">
            <Txt v="h2">{M.myManagers}</Txt>
            {data.managers.length ? (
              <Txt tone="muted" style={small}>
                {M.effectNote}
              </Txt>
            ) : null}
            {!data.hasTeam && data.managers.length ? (
              <Txt tone="muted" style={small}>
                {M.needTeam}
              </Txt>
            ) : null}
            {data.managers.length ? (
              data.managers.map((m) => {
                const r = m.result!;
                const seated = data.coachId === m.careerId;
                return (
                  <View
                    key={m.id}
                    testID={`manager-card-${m.careerId}`}
                    style={{
                      gap: 6,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: c.line,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt bold>{nameOf(m)}</Txt>
                      <Txt bold tone="accent">
                        {M.grade({ grade: r.grade })}
                      </Txt>
                      {seated ? (
                        <Txt tone="muted" bold style={tiny}>
                          {M.coachNow}
                        </Txt>
                      ) : null}
                    </View>
                    <Txt style={small}>
                      {`${endingName(r.ending)} · ${M.seasons({ n: r.seasons })} · ${M.honors({
                        titles: r.titles,
                        cups: r.cups,
                        promotions: r.promotions,
                      })}`}
                    </Txt>
                    <CardBody r={r} />
                    {data.hasTeam ? (
                      <Btn
                        sm
                        kind={seated ? 'default' : 'primary'}
                        testID={seated ? 'manager-unseat' : 'manager-seat'}
                        disabled={busy}
                        style={{ alignSelf: 'flex-start' }}
                        onPress={() => void seat(seated ? null : m.careerId)}
                      >
                        {seated ? M.unseat : M.seat}
                      </Btn>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Txt tone="muted" style={small}>
                {M.noManagers}
              </Txt>
            )}
            {play && st?.phase !== 'done' ? errLine : null}
          </Card>
        </>
      )}
    </Screen>
  );
}
