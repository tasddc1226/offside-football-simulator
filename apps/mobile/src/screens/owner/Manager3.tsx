// T-11-648 감독 커리어 3(감독 키우기) 진행 화면(웹 ui/Manager3.svelte와 같은 단계). 커리어는 기기에서 돌고(세이브
// ft_mgr3_save), 끝나면 감독 카드로 확정한다. 서버는 포기 · 완료 때만 부른다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import type { ManagerCareer } from '@offside/contracts';
import type { ManagerStyle } from '@offside/contracts/manager-rules';
import { tn } from '@offside/game/i18n/names';
import {
  endingDesc,
  endingName,
  leagueName,
  specialName,
  styleName,
  targetName,
} from '@offside/game/manager';
import {
  M3_ATTRS,
  M3_BLOCKS,
  M3_FORMATIONS,
  M3_TALKS,
  acceptOffer,
  answerBid,
  answerEvent,
  attrCap,
  autoLineup,
  bestSeason3,
  boardMinimum,
  canRetire,
  closeWindow,
  continueBlock,
  continueReview,
  expectedRank,
  listPlayer,
  managerResult3,
  playBlock,
  playerValue,
  releasePlayer,
  renewPlayer,
  renewWage,
  restSeason,
  retire,
  setPlan,
  signTarget,
  sortTable,
  spendPoint,
  squadDisplayName,
  startSeason,
  stayAtClub,
  targetOptions,
  wageBill,
  type BidResult,
  type M3Attr,
  type M3Level,
  type M3State,
} from '@offside/game/manager3';
import { managerAvatarSpec } from '@offside/game/avatar';
import {
  clearManager3State,
  loadManager3State,
  saveManager3State,
} from '@offside/app-core/manager3';
import {
  M3_SQUAD_SORTS,
  blockRounds,
  eventView,
  playerLine,
  retireInfo,
  roleName,
  seasonSteps3,
  sortSquad,
  type M3SquadSort,
} from '@offside/app-core/manager3View';
import { abandonManager, finishManager } from '@offside/app-core/manager';
import { fmtValue } from '@offside/app-core/format';
import { manager3Text as T } from '@offside/app-core/i18n/ko/manager3';
import { managerText as M } from '@offside/app-core/i18n/ko/manager';
import { buzz } from '../../game/host';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Txt } from '../../ui';
import { PixelAvatar } from '../../ui/PixelAvatar';
import { ProgBar } from '../../sheets/parts';

const small = { fontSize: rem(FONT.body2) } as const;
const tiny = { fontSize: rem(FONT.caption) } as const;
const MENTALITIES: readonly ManagerStyle[] = ['attack', 'balance', 'defense', 'counter'];
const LEVELS: readonly M3Level[] = [0, 1, 2];

/** 고르는 칩(웹 .mg-chip). */
function Chip({
  on,
  label,
  sub,
  onPress,
  testID,
}: {
  on?: boolean;
  label: string;
  sub?: string | undefined;
  onPress?: () => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'radio' : undefined}
      accessibilityState={onPress ? { selected: !!on } : undefined}
      style={{
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: RADIUS.sm,
        borderWidth: on ? 2 : 1,
        borderColor: on ? c.accent : c.line,
        backgroundColor: on ? c.surface2 : 'transparent',
      }}
    >
      <Txt bold style={small}>
        {label}
      </Txt>
      {sub ? (
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
          {sub}
        </Txt>
      ) : null}
    </Press>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {children}
    </View>
  );
}

/** 이름 · 설명 줄과 오른쪽 버튼(웹 .mg-row). */
function Row({ title, lines, action }: { title?: string; lines: string[]; action?: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: RADIUS.md,
        backgroundColor: c.surface2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {title ? <Txt bold>{title}</Txt> : null}
        {lines.map((l, i) => (
          <Txt key={i} tone={title ? 'muted' : 'ink'} style={tiny}>
            {l}
          </Txt>
        ))}
      </View>
      {action ? <View style={{ flexDirection: 'row', gap: 6 }}>{action}</View> : null}
    </View>
  );
}

/** 접는 묶음(웹 details). */
function Fold({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }} testID={testID}>
      <Press
        onPress={() => setOpen((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
      >
        <Txt bold style={[small, { flex: 1 }]}>
          {title}
        </Txt>
        <Txt tone="muted">{open ? '▴' : '▾'}</Txt>
      </Press>
      {open ? children : null}
    </View>
  );
}

/** 능력치 막대 한 줄. */
function AttrRow({ label, value, action }: { label: string; value: number; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Txt style={[small, { width: 76 }]} numberOfLines={1}>
        {label}
      </Txt>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surface2 }}>
        <View
          style={{
            width: `${Math.min(100, value)}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.accent,
          }}
        />
      </View>
      <Txt bold num style={[small, { width: 26, textAlign: 'right' }]}>
        {value}
      </Txt>
      {action}
    </View>
  );
}

export function Manager3({
  career,
  name,
  onChange,
}: {
  career: ManagerCareer;
  name: string;
  onChange: () => void;
}) {
  const c = useColors();
  // 부모가 커리어 id로 다시 만들므로 처음 값만 읽는다.
  const [st, setSt] = useState<M3State>(() => loadManager3State(career, name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<'targets' | 'squad' | 'bids'>('targets');
  const [squadSort, setSquadSort] = useState<M3SquadSort>('pos');
  const [pickTarget, setPickTarget] = useState(() => boardMinimum(st));

  /** 엔진 함수로 상태를 바꾸고 저장한다. 엔진이 제자리에서 바꾸므로 사본에 적용해 새 상태로 넣는다. */
  function act<R>(fn: (s: M3State) => R): R {
    const next = JSON.parse(JSON.stringify(st)) as M3State;
    const out = fn(next);
    saveManager3State(next);
    if (next.phase === 'preseason' && st.phase !== 'preseason') setPickTarget(boardMinimum(next));
    // 이적시장이 새로 열리면 영입 후보 탭부터 보여 준다.
    if (next.phase === 'window' && st.phase !== 'window') setTab('targets');
    setSt(next);
    return out;
  }

  const pname = (n: string) => squadDisplayName(n);
  const nameOfId = (id: number) => pname(st.squad.find((p) => p.id === id)?.name ?? '');
  const lvl = (n: M3Level) => [T.level0, T.level1, T.level2][n]!;
  const ev = st.phase === 'blockResult' ? (st.lastReport?.event ?? null) : null;
  const evText = ev ? eventView(st, ev) : null;
  const steps = seasonSteps3(st);
  // 감독 모습: 은퇴한 그 선수(커리어 ID · 은퇴 때 꾸미기)가 지금 나이로 정장을 입은 모습.
  const face = useMemo(
    () => managerAvatarSpec(career.careerId, st.age, career.look),
    [career.careerId, career.look, st.age],
  );
  const table = st.table.length ? sortTable(st.table) : [];
  const myRank = st.club ? table.findIndex((t) => t.clubId === st.club!.id) + 1 : 0;
  const lineup = st.phase === 'block' ? autoLineup(st.squad, st.plan.formation, 55) : [];
  const result = st.phase === 'done' ? managerResult3(st) : null;
  const best = st.phase === 'done' ? bestSeason3(st) : null;
  const cap = attrCap(st.license);

  function bid(i: number) {
    const t = st.targets[i];
    if (!t) return;
    const nm = pname(t.player.name);
    const r: BidResult = act((s) => signTarget(s, i));
    setNote(
      r === 'signed'
        ? T.bid_signed({ name: nm })
        : r === 'refused'
          ? T.bid_refused({ name: nm })
          : r === 'money'
            ? T.bid_money
            : r === 'full'
              ? T.bid_full
              : T.bid_none,
    );
    buzz();
  }
  function closeWin() {
    const sold = act(closeWindow);
    setNote(sold?.length ? T.soldLine({ names: sold.map(pname).join(', ') }) : null);
  }
  function play() {
    setNote(null);
    act(playBlock);
    buzz();
  }
  async function finish() {
    const res = managerResult3(st);
    if (!res) return;
    setBusy(true);
    setError(null);
    const r = await finishManager(st.id, res);
    setBusy(false);
    if (!r.ok) return setError(T.cardSendFail);
    clearManager3State();
    onChange();
  }
  const askRetire = () =>
    Alert.alert(T.retire, T.retireConfirm, [
      { text: M.cancel, style: 'cancel' },
      { text: T.retire, onPress: () => act(retire) },
    ]);
  const askAbandon = () =>
    Alert.alert(M.abandon, M.abandonConfirm, [
      { text: M.cancel, style: 'cancel' },
      {
        text: M.abandonOk,
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          setError(null);
          void abandonManager(st.id).then((r) => {
            setBusy(false);
            if (!r.ok) return setError(r.error.message);
            clearManager3State();
            onChange();
          });
        },
      },
    ]);

  const noteLine = note ? (
    <Txt style={small} accessibilityRole="text" accessibilityLiveRegion="polite">
      {note}
    </Txt>
  ) : null;
  const errLine = error ? (
    <Txt tone="bad" bold accessibilityRole="alert">
      {error}
    </Txt>
  ) : null;

  const stats: [string, number][] = [
    [T.repLabel, st.rep],
    [T.boardLabel, st.board],
    [T.fansLabel, st.fans],
    [T.harmonyLabel, st.harmony],
  ];

  let body: ReactNode = null;
  if (st.phase === 'offers') {
    body = (
      <Card gap={10} testID="manager3-offers">
        <Txt v="h2">{T.offersHeading}</Txt>
        {st.offers.length ? (
          st.offers.map((o, i) => (
            <Row
              key={o.clubId}
              title={tn(o.name)}
              lines={[
                `${T.offerMeta({ league: leagueName(o.leagueId), str: Math.round(o.base) })}${
                  o.vacancy ? ` · ${T.offerVacancy}` : ''
                }`,
              ]}
              action={
                <Btn
                  sm
                  kind="primary"
                  testID="m3-accept"
                  onPress={() => act((s) => acceptOffer(s, i))}
                >
                  {T.offerAccept}
                </Btn>
              }
            />
          ))
        ) : (
          <Txt tone="muted" style={small}>
            {T.offersEmpty}
          </Txt>
        )}
        {st.club ? (
          <Btn testID="m3-stay" onPress={() => act(stayAtClub)}>
            {T.offerStay}
          </Btn>
        ) : null}
        {!st.club && !st.offers.length ? (
          <Btn testID="m3-rest" onPress={() => act(restSeason)}>
            {T.offerRest}
          </Btn>
        ) : null}
      </Card>
    );
  } else if (st.phase === 'preseason' && st.club) {
    const exp = expectedRank(st);
    const min = boardMinimum(st);
    body = (
      <Card gap={10} testID="manager3-preseason">
        <Txt v="h2">{T.preseasonHeading}</Txt>
        <Txt style={small}>
          {`${T.facilities({ train: st.club.trainFac, youth: st.club.youthFac })} · ${T.expected(exp)}`}
        </Txt>
        <Txt bold>{T.targetHeading}</Txt>
        <Txt tone="muted" style={small}>
          {T.targetLead}
        </Txt>
        <Chips>
          {targetOptions(st).map((t) => (
            <Chip
              key={t}
              on={pickTarget === t}
              label={targetName(t)}
              sub={t === min ? T.targetMin : undefined}
              onPress={() => setPickTarget(t)}
            />
          ))}
        </Chips>
        <Btn
          kind="primary"
          testID="m3-season"
          onPress={() => act((s) => startSeason(s, pickTarget))}
        >
          {T.seasonStart}
        </Btn>
      </Card>
    );
  } else if (st.phase === 'window') {
    body = (
      <Card gap={10} testID={`manager3-window-${st.window}`}>
        <Txt v="h2">{st.window === 'winter' ? T.windowWinter : T.windowSummer}</Txt>
        <Chips>
          <Chip on={tab === 'targets'} label={T.tabTargets} onPress={() => setTab('targets')} />
          <Chip on={tab === 'squad'} label={T.tabSquad} onPress={() => setTab('squad')} />
          <Chip
            on={tab === 'bids'}
            label={T.tabBids({ n: st.bids.length })}
            onPress={() => setTab('bids')}
          />
        </Chips>
        {/* 제안 결과는 탭 바로 아래에 둬서 목록 위쪽에서 눌러도 보인다. */}
        {noteLine}
        {tab === 'targets'
          ? st.targets.map((t, i) => (
              <Row
                key={t.player.id}
                title={pname(t.player.name)}
                lines={[
                  T.targetMeta({
                    role: roleName(t.player),
                    age: t.player.age,
                    club: t.fromClub ? tn(t.fromClub) : T.freeAgent,
                  }),
                  `${T.ovrRange({ lo: t.ovrLo, hi: t.ovrHi })} · ${T.potRange({ lo: t.potLo, hi: t.potHi })}`,
                  `${T.fee({ fee: fmtValue(t.fee) })} · ${T.willing({ pct: Math.round(t.willing * 100) })}`,
                ]}
                action={
                  <Btn sm testID="m3-bid" onPress={() => bid(i)}>
                    {T.bid}
                  </Btn>
                }
              />
            ))
          : tab === 'squad'
            ? [
                <Chips key="sort">
                  {M3_SQUAD_SORTS.map((k) => (
                    <Chip
                      key={k}
                      testID={`m3-sort-${k}`}
                      on={squadSort === k}
                      label={T[`sort_${k}`]}
                      onPress={() => setSquadSort(k)}
                    />
                  ))}
                </Chips>,
                ...sortSquad(st.squad, squadSort).map((p) => (
                  <Row
                    key={p.id}
                    title={`${pname(p.name)}${p.academy ? ` · ${T.academy}` : ''}`}
                    lines={[
                      playerLine(p),
                      `${T.contract({ n: p.contract })} · ${T.wage({ wage: fmtValue(p.wage) })}`,
                    ]}
                    action={
                      <>
                        <Btn
                          sm
                          onPress={() =>
                            act((s) =>
                              listPlayer(s, p.id, p.listed === null ? playerValue(p) : null),
                            )
                          }
                        >
                          {p.listed === null ? T.list : T.unlist}
                        </Btn>
                        <Btn sm kind="danger" onPress={() => act((s) => releasePlayer(s, p.id))}>
                          {T.release}
                        </Btn>
                      </>
                    }
                  />
                )),
              ]
            : !st.bids.length
              ? [
                  <Txt key="empty" tone="muted" style={small}>
                    {T.bidsEmpty}
                  </Txt>,
                ]
              : st.bids.map((b, i) => (
                  <Row
                    key={b.player}
                    lines={[
                      T.bidFrom({
                        club: tn(b.club),
                        name: nameOfId(b.player),
                        fee: fmtValue(b.fee),
                      }),
                    ]}
                    action={
                      <>
                        <Btn sm onPress={() => act((s) => answerBid(s, i, true))}>
                          {T.bidAccept}
                        </Btn>
                        <Btn sm onPress={() => act((s) => answerBid(s, i, false))}>
                          {T.bidReject}
                        </Btn>
                      </>
                    }
                  />
                ))}
        <Btn kind="primary" testID="m3-close-window" onPress={closeWin}>
          {T.windowClose}
        </Btn>
      </Card>
    );
  } else if (st.phase === 'block') {
    const rr = blockRounds(st);
    const levels = [
      ['press', T.planPress, T.pressDesc],
      ['line', T.planLine, T.lineDesc],
      ['tempo', T.planTempo, T.tempoDesc],
    ] as const;
    body = (
      <Card gap={10} testID={`manager3-block-${st.block}`}>
        <Txt v="h2">{T.blockHeading({ n: st.block + 1, total: M3_BLOCKS })}</Txt>
        <Txt tone="muted" style={small}>
          {`${T.blockRounds(rr)}${myRank ? ` · ${T.tableRow({ rank: myRank, pts: table[myRank - 1]!.pts })}` : ''}`}
        </Txt>
        {noteLine}
        <Txt bold>{T.planFormation}</Txt>
        <Chips>
          {M3_FORMATIONS.map((f) => (
            <Chip
              key={f}
              on={st.plan.formation === f}
              label={f}
              sub={T.famLabel({ n: st.fam[f] })}
              onPress={() => act((s) => setPlan(s, { formation: f }))}
            />
          ))}
        </Chips>
        <Txt bold>{T.planMentality}</Txt>
        <Chips>
          {MENTALITIES.map((m) => (
            <Chip
              key={m}
              on={st.plan.mentality === m}
              label={styleName(m)}
              onPress={() => act((s) => setPlan(s, { mentality: m }))}
            />
          ))}
        </Chips>
        {levels.map(([k, label, desc]) => (
          <View key={k} style={{ gap: 4 }}>
            <Txt style={small}>{label}</Txt>
            <Chips>
              {LEVELS.map((n) => (
                <Chip
                  key={n}
                  on={st.plan[k] === n}
                  label={lvl(n)}
                  onPress={() => act((s) => setPlan(s, { [k]: n }))}
                />
              ))}
            </Chips>
            <Txt tone="muted" style={tiny}>
              {desc}
            </Txt>
          </View>
        ))}
        <Txt bold>{T.planTalk}</Txt>
        <Chips>
          {M3_TALKS.map((t) => (
            <Chip
              key={t}
              on={st.plan.talk === t}
              label={T[`talk_${t}`]}
              onPress={() => act((s) => setPlan(s, { talk: t }))}
            />
          ))}
        </Chips>
        <Txt tone="muted" style={tiny}>
          {T[`talkDesc_${st.plan.talk}`]}
        </Txt>
        <Fold title={`${T.lineupHeading} · ${T.lineupAuto}`}>
          {lineup.map((id, i) => {
            const p = st.squad.find((x) => x.id === id);
            return (
              <Txt key={i} style={tiny}>
                {p ? `${pname(p.name)} · ${playerLine(p)} · ${T.fitness} ${p.fit}` : T.lineupEmpty}
              </Txt>
            );
          })}
        </Fold>
        <Fold title={T.tableHeading}>
          {table.map((t, i) => (
            <Txt
              key={t.clubId}
              bold={t.clubId === st.club?.id}
              tone={t.clubId === st.club?.id ? 'accent' : 'ink'}
              style={tiny}
            >
              {`${i + 1}. ${tn(t.name)} · ${t.pts}`}
            </Txt>
          ))}
        </Fold>
        <Btn kind="primary" testID="m3-play" onPress={play}>
          {T.playBlock}
        </Btn>
      </Card>
    );
  } else if (st.phase === 'blockResult' && st.lastReport) {
    const rep = st.lastReport;
    body = (
      <Card gap={10} testID={`manager3-result-${rep.block}`}>
        <Txt v="h2">{T.resultHeading({ n: rep.block + 1 })}</Txt>
        <Txt style={small}>
          {`${T.rankMove({ from: rep.rankBefore, to: rep.rankAfter })} · ${T.moraleAvg({ n: rep.morale })}`}
        </Txt>
        <View style={{ gap: 4 }}>
          {rep.matches.map((m, i) => {
            const win = m.gf > m.ga || m.pens === true;
            const loss = m.gf < m.ga || m.pens === false;
            return (
              <View key={i} style={{ gap: 1 }}>
                <Txt style={small} tone={win ? 'good' : loss ? 'bad' : 'ink'}>
                  {`${m.cup ? `${T.cupTag} ` : ''}${tn(m.oppName)} · ${m.home ? T.home : T.away} · ${m.gf}:${m.ga}${
                    m.pens !== undefined ? ` · ${m.pens ? T.pensWon : T.pensLost}` : ''
                  }`}
                </Txt>
                {m.scorers.length ? (
                  <Txt tone="muted" style={tiny}>
                    {T.scorers({ names: m.scorers.map(nameOfId).join(', ') })}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </View>
        {rep.injuries.length ? (
          <Txt style={small}>{T.injuries({ names: rep.injuries.map(nameOfId).join(', ') })}</Txt>
        ) : null}
        {ev && evText ? (
          <View
            testID={`manager3-event-${ev.id}`}
            style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line }}
          >
            <Txt bold>{evText.title}</Txt>
            <Txt style={small}>{evText.body}</Txt>
            {evText.detail ? (
              <Txt bold style={small} testID="manager3-event-detail">
                {evText.detail}
              </Txt>
            ) : null}
            {evText.result === null ? (
              evText.choices.map((ch, i) => (
                <Btn key={i} testID="m3-choice" onPress={() => act((s) => answerEvent(s, i))}>
                  {ch}
                </Btn>
              ))
            ) : (
              <Txt bold tone="accent" style={small}>
                {evText.result}
              </Txt>
            )}
          </View>
        ) : null}
        {!ev || ev.choice !== null ? (
          <Btn kind="primary" testID="m3-next" onPress={() => act(continueBlock)}>
            {st.block >= M3_BLOCKS ? T.toReview : st.block === 3 ? T.toWinter : T.next}
          </Btn>
        ) : null}
      </Card>
    );
  } else if (st.phase === 'review' && st.review) {
    const rv = st.review;
    const h = rv.record;
    const badges = [
      h.title && T.reviewTitle,
      h.cup && T.reviewCup,
      h.promoted && T.reviewPromoted,
      h.relegated && T.reviewRelegated,
      h.award && T.reviewAward,
      h.met ? T.reviewMet : T.reviewMissed,
    ].filter((x): x is string => !!x);
    const info = retireInfo(st);
    body = (
      <Card gap={10} testID="manager3-review">
        <Txt v="h2">{T.reviewHeading({ n: h.n })}</Txt>
        <Txt>{T.reviewRank({ club: tn(h.club ?? ''), rank: h.rank, teams: h.teams })}</Txt>
        <Txt tone="muted" style={small}>
          {T.reviewRecord({ w: h.w, d: h.d, l: h.l, gf: h.gf, ga: h.ga })}
        </Txt>
        <Chips>
          {badges.map((b) => (
            <Chip key={b} label={b} />
          ))}
        </Chips>
        {h.topScorer ? (
          <Txt style={small}>
            {T.reviewTopScorer({ name: pname(h.topScorer.name), goals: h.topScorer.goals })}
          </Txt>
        ) : null}
        {rv.sacked ? (
          <Txt tone="bad" bold>
            {rv.midSeason ? T.reviewSackedMid : T.reviewSacked}
          </Txt>
        ) : null}
        {rv.licenseUp ? (
          <Txt style={small}>{T.reviewLicense({ license: rv.licenseUp })}</Txt>
        ) : null}
        {rv.growth.length ? (
          <Fold title={T.growthHeading}>
            {[...rv.growth]
              .sort((a, b) => b.d - a.d)
              .map((g) => {
                const p = st.squad.find((x) => x.id === g.id);
                return p ? (
                  <Txt key={g.id} style={tiny}>
                    {T.growthLine({ name: pname(p.name), d: g.d })}
                  </Txt>
                ) : null;
              })}
          </Fold>
        ) : null}
        {rv.retired.length ? (
          <Txt style={small}>{`${T.retiredHeading} · ${rv.retired.map(pname).join(', ')}`}</Txt>
        ) : null}
        {rv.intake.length ? (
          <Txt style={small}>{`${T.intakeHeading} · ${rv.intake.map(nameOfId).join(', ')}`}</Txt>
        ) : null}
        {rv.expiring.length ? (
          <View style={{ gap: 6 }}>
            <Txt bold>{T.expiringHeading}</Txt>
            <Txt tone="muted" style={small}>
              {T.expiringLead}
            </Txt>
            {rv.expiring.map((id) => {
              const p = st.squad.find((x) => x.id === id);
              return p ? (
                <Row
                  key={id}
                  title={pname(p.name)}
                  lines={[
                    `${playerLine(p)} · ${T.wage({ wage: fmtValue(p.wage) })} → ${T.renewWage({ wage: fmtValue(renewWage(st, p)) })}`,
                  ]}
                  action={
                    <Btn sm onPress={() => act((s) => renewPlayer(s, id))}>
                      {T.renew}
                    </Btn>
                  }
                />
              ) : null;
            })}
          </View>
        ) : null}
        <Txt bold>{T.pointsHeading({ n: st.points })}</Txt>
        <Txt tone="muted" style={small}>
          {T.pointsLead({ cap })}
        </Txt>
        <View style={{ gap: 6 }}>
          {M3_ATTRS.map((k) => (
            <AttrRow
              key={k}
              label={T[`attr_${k}`]}
              value={st.attrs[k]}
              action={
                <Btn
                  sm
                  accessibilityLabel={T.pointAdd({ attr: T[`attr_${k}`] })}
                  disabled={st.points <= 0 || st.attrs[k] >= cap}
                  onPress={() => act((s) => spendPoint(s, k as M3Attr))}
                >
                  +
                </Btn>
              }
            />
          ))}
        </View>
        <Btn kind="primary" testID="m3-continue" onPress={() => act(continueReview)}>
          {T.continueSeason}
        </Btn>
        {canRetire(st) ? (
          <Btn testID="m3-retire" onPress={askRetire}>
            {T.retire}
          </Btn>
        ) : null}
        {info ? (
          <Txt tone="muted" style={small}>
            {info}
          </Txt>
        ) : null}
        <Txt tone="muted" style={small}>
          {T.forcedEnd}
        </Txt>
      </Card>
    );
  } else if (st.phase === 'done' && result) {
    body = (
      <Card gap={10} testID="manager3-card">
        <View style={{ alignItems: 'center' }}>
          <PixelAvatar spec={face} width={120} />
        </View>
        <Txt v="h2">{T.cardHeading}</Txt>
        <Txt>
          <Txt bold>{M.grade({ grade: result.grade })}</Txt>
          {` · ${endingName(result.ending)} · ${T.cardSeasons({ n: result.seasons })}`}
        </Txt>
        <Txt tone="muted" style={small}>
          {endingDesc(result.ending)}
        </Txt>
        <Txt style={small}>{T.cardRecord(result)}</Txt>
        {best && best.club ? (
          <Txt style={small}>{T.cardBest({ n: best.n, club: tn(best.club), rank: best.rank })}</Txt>
        ) : null}
        <Chips>
          {Object.entries(result.mastery).map(([f, g]) => (
            <Chip key={f} label={f} sub={M.mastery({ grade: g })} />
          ))}
        </Chips>
        <Txt style={small}>
          {`${M.style} ${styleName(result.style)} · ${M.specials} ${
            result.specials.length ? result.specials.map(specialName).join(' · ') : M.noSpecials
          }`}
        </Txt>
        <View style={{ gap: 6 }}>
          {M3_ATTRS.map((k) => (
            <AttrRow key={k} label={T[`attr_${k}`]} value={st.attrs[k]} />
          ))}
        </View>
        {errLine}
        <Btn kind="primary" testID="m3-finish" disabled={busy} onPress={() => void finish()}>
          {T.cardConfirm}
        </Btn>
      </Card>
    );
  }

  return (
    <>
      <Card gap={10} testID={`manager3-${st.phase}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PixelAvatar spec={face} width={64} portrait />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt bold>{name}</Txt>
            <Txt tone="muted" style={tiny}>
              {`${T.seasonLabel({ n: st.season + (st.phase === 'done' ? 0 : 1) })} · ${T.ageLabel({ age: st.age })} · ${T.licenseLabel({ license: st.license })}`}
            </Txt>
            <Txt style={tiny}>
              {st.club ? `${tn(st.club.name)} · ${leagueName(st.club.leagueId)}` : T.noClub}
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {stats.map(([label, v]) => (
            <View
              key={label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 6,
                borderRadius: RADIUS.sm,
                backgroundColor: c.surface2,
              }}
            >
              <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }} numberOfLines={1}>
                {label}
              </Txt>
              <Txt bold num>
                {v}
              </Txt>
            </View>
          ))}
        </View>
        {st.phase !== 'done' ? (
          <View style={{ gap: 6 }}>
            <ProgBar progress={steps.progress} fill={0} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {steps.steps.map((t, i) => (
                <Txt
                  key={i}
                  bold={i === steps.active}
                  tone={i === steps.active ? 'accent' : i < steps.active ? 'muted' : 'ink'}
                  style={{ fontSize: rem(FONT.caption2) }}
                >
                  {t}
                </Txt>
              ))}
            </View>
          </View>
        ) : null}
        {st.club && st.phase !== 'offers' && st.phase !== 'preseason' && st.phase !== 'done' ? (
          <Txt tone="muted" style={tiny}>
            {`${T.budgetLabel} ${fmtValue(st.club.budget)} · ${T.wageLabel} ${fmtValue(wageBill(st))} / ${fmtValue(st.club.wageBudget)}`}
          </Txt>
        ) : null}
      </Card>

      {body}

      {st.history.length ? (
        <Card gap={4} testID="manager3-history">
          <Fold title={T.historyHeading}>
            {st.history.map((h, i) => (
              <Txt key={i} style={tiny}>
                {h.clubId && h.club
                  ? T.historyRow({ n: h.n, club: tn(h.club), rank: h.rank, teams: h.teams })
                  : `${h.n} · ${T.historyRest}`}
              </Txt>
            ))}
          </Fold>
        </Card>
      ) : null}
      {st.phase !== 'done' ? (
        <>
          {errLine}
          <Btn kind="danger" testID="m3-abandon" disabled={busy} onPress={askAbandon}>
            {M.abandon}
          </Btn>
        </>
      ) : null}
    </>
  );
}
