// T-11-418 오프사이드 리그 화면(홈의 리그 배너로 연다, 웹 League.svelte) — 일정 · 규칙 · 내 신청. T-11-418b 배치 뒤에는
// 내 배치 · 리그 고르기 · 순위표 · 라운드 경기 · 경기 상세. 리그 한눈에는 누구나, 내 신청은 로그인한 구단주만 묻는다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { isMember } from '@offside/app-core/account';
import {
  enterLeague,
  fetchLeague,
  fetchLeagueMe,
  withdrawLeague,
  type LeagueMatch,
  type LeagueMeResponse,
  type LeagueResponse,
  type LeagueTableResponse,
} from '@offside/app-core/api/league';
import { cupAppText as A } from '@offside/app-core/i18n/ko/cupApp';
import { leagueText as L } from '@offside/app-core/i18n/ko/league';
import {
  leagueChoices,
  leagueDefaultPick,
  leagueDefaultRound,
  leagueLine,
  leagueOnHome,
  leaguePlacementLine,
  type LeaguePick,
  leaguePhaseLabel,
  leaguePresign,
  leagueReadiness,
  leagueRules,
  leagueSchedule,
  leagueWhen,
} from '@offside/app-core/leagueView';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { refreshAccount, toast } from '../../game/host';
import { go } from '../../game/nav';
import { startGoogleLogin } from '../../platform/auth';
import { accountCache } from '../../store';
import { Btn, Card, Pill, Press, Screen, Skeleton, Topbar, Txt, scrollTo } from '../../ui';
import { GoogleLoginButton } from '../../ui/GoogleLoginButton';
import { useOnPull } from '../../ui/refresh';
import { LeagueBoard, LeagueMatchDetail, LeaguePicker } from './LeagueBoard';

/** 홈의 리그 배너(누구나 보는 리그 소식). 리그가 끝났거나 불러오지 못하면 그리지 않는다. */
export function LeagueBanner() {
  const [data, setData] = useState<LeagueResponse | null>(null);
  const reload = useCallback(async () => {
    const r = await fetchLeague();
    if (r.ok) setData(r.data);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useOnPull(reload);
  if (!data || !leagueOnHome(data)) return null;
  return (
    <Press
      onPress={() => go('league')}
      testID="league-open"
      scale={0.985}
      accessibilityLabel={`${L.seasonTitle({ season: data.league.season })} · ${L.open}`}
    >
      <Card gap={8} testID="league-banner">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="eyebrow">Offside League</Txt>
            <Txt v="h2" accessibilityRole="header">
              {L.seasonTitle({ season: data.league.season })}
            </Txt>
          </View>
          <Pill tone={data.phase === 'open' ? 'good' : undefined}>
            {leaguePhaseLabel(data.phase)}
          </Pill>
        </View>
        <Txt v="sm">{leagueLine(data)}</Txt>
      </Card>
    </Press>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Txt v="sm" tone="muted">
        {k}
      </Txt>
      <Txt v="sm" bold style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </Txt>
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Txt v="sm" tone="muted">
        ·
      </Txt>
      <Txt v="sm" style={{ flex: 1 }}>
        {children}
      </Txt>
    </View>
  );
}

/** 내 신청 카드: 로그인 · 신청 · 취소 · 신청할 수 없는 이유. */
function EntryCard({
  data,
  me,
  linked,
  reload,
}: {
  data: LeagueResponse;
  me: LeagueMeResponse | null;
  linked: boolean;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<'enter' | 'withdraw' | null>(null);
  const lock = useRef(false);
  const cache = useSnapshot(accountCache);

  async function run(kind: 'enter' | 'withdraw') {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    try {
      const r = await (kind === 'enter' ? enterLeague() : withdrawLeague());
      if (!r.ok) toast(r.error.message || A.actionFail);
      else toast(kind === 'enter' ? L.toastEntered : L.toastWithdrawn);
      await reload();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  const askWithdraw = () =>
    Alert.alert(A.withdrawAskTitle, L.withdrawConfirm, [
      { text: A.withdrawKeep, style: 'cancel' },
      { text: L.withdraw, style: 'destructive', onPress: () => void run('withdraw') },
    ]);

  const { phase, league } = data;
  if (!linked) {
    if (phase !== 'soon' && phase !== 'open') return null;
    // 계정 상태를 아직 모르면(불러오는 중) 로그인 버튼을 띄우지 않는다.
    if (!cache.value || cache.value === 'error') return null;
    return (
      <Card gap={10} testID="league-login">
        <Txt v="sm">{L.loginToEnter}</Txt>
        <GoogleLoginButton
          testID="league-login-google"
          onPress={() => void startGoogleLogin({ league: true })}
        />
      </Card>
    );
  }
  if (!me) return null;
  const entry = me.entry;
  const ready = leagueReadiness(data, me);
  const placement = leaguePlacementLine(me);
  const drawAt = leagueWhen(league.drawAt);
  return (
    <Card gap={10} testID="league-entry">
      {entry ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View testID="league-entered">
              <Pill tone="good">{L.entered}</Pill>
            </View>
            {phase === 'open' ? (
              <Btn
                sm
                testID="league-withdraw"
                disabled={busy !== null}
                onPress={askWithdraw}
                style={{ marginLeft: 'auto' }}
              >
                {busy === 'withdraw' ? L.withdrawing : L.withdraw}
              </Btn>
            ) : null}
          </View>
          {phase === 'open' || phase === 'closed' ? (
            <Txt v="sm" tone="muted">
              {L.enteredNote({ at: drawAt })}
            </Txt>
          ) : !placement ? (
            <Txt v="sm" tone="muted">
              {L.drawPending}
            </Txt>
          ) : null}
        </>
      ) : me.canEnter ? (
        <Btn
          kind="accent"
          testID="league-enter"
          disabled={busy !== null}
          onPress={() => void run('enter')}
        >
          {busy === 'enter' ? L.entering : L.enter}
        </Btn>
      ) : phase !== 'soon' ? (
        <Txt v="sm" tone="muted">
          {L.notEntered}
        </Txt>
      ) : null}
      {leaguePresign(data) ? (
        <Txt v="sm" tone="muted" testID="league-presign">
          {L.presignNote({ season: league.season, at: leagueWhen(league.startsAt) })}
        </Txt>
      ) : null}
      {ready ? (
        <Txt v="sm" tone={ready.ok ? 'muted' : 'warn'} testID="league-ready">
          {ready.text}
        </Txt>
      ) : null}
      {me.team && phase === 'open' ? (
        <Txt v="xs" tone="muted">
          {L.myOvr({ ovr: me.team.ovr })}
        </Txt>
      ) : null}
      {placement ? (
        <Txt v="sm" bold tone={placement.ok ? 'ink' : 'warn'} testID="league-placement">
          {placement.text}
        </Txt>
      ) : null}
    </Card>
  );
}

export default function League() {
  const cache = useSnapshot(accountCache);
  const acct = cache.value;
  const linked = !!acct && acct !== 'error' && isMember(acct);
  const [data, setData] = useState<LeagueResponse | null>(null);
  const [me, setMe] = useState<LeagueMeResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const seq = useRef(0);
  // 배치 뒤: 고른 리그(처음엔 내 리그) · 라운드 · 연 경기.
  const [pick, setPick] = useState<LeaguePick | null>(null);
  const [round, setRound] = useState(1);
  const picked = useRef(false);
  const [detail, setDetail] = useState<{ m: LeagueMatch; table: LeagueTableResponse } | null>(null);
  // 홈을 거치지 않고 들어와도(되돌아가기 등) 로그인 상태를 알아야 내 신청을 묻는다.
  useEffect(() => {
    if (accountCache.value === undefined) void refreshAccount();
  }, []);
  const reload = useCallback(
    async (silent = false) => {
      const n = ++seq.current;
      if (!silent) setStatus('loading');
      const [a, b] = await Promise.all([fetchLeague(), linked ? fetchLeagueMe() : null]);
      if (n !== seq.current) return;
      if (!a.ok) {
        if (!silent) setStatus('error');
        return;
      }
      setData(a.data);
      const mine = b?.ok ? b.data : null;
      setMe(mine);
      if (!picked.current && a.data.tiers) {
        setPick(leagueDefaultPick(a.data, mine));
        setRound(leagueDefaultRound(a.data));
      }
      setStatus('ready');
    },
    [linked],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useOnPull(() => reload(true));
  const mineId = me?.placement?.teamId ?? null;
  const p = me?.placement;
  const mine = p && p.tier && p.league ? { tier: p.tier, league: p.league } : null;

  if (detail && data)
    return (
      <Screen>
        <Topbar />
        <LeagueMatchDetail
          season={data.league.season}
          matchId={detail.m.id}
          table={detail.table}
          mineId={mineId}
          back={() => setDetail(null)}
        />
      </Screen>
    );

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Offside League</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {data ? L.seasonTitle({ season: data.league.season }) : L.title}
        </Txt>
      </View>
      {!data ? (
        status === 'error' ? (
          <Card gap={10}>
            <LoadState status={status} failText={L.loadFail} retry={() => void reload()}>
              {null}
            </LoadState>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            <Skeleton height={120} />
            <Skeleton height={200} />
          </View>
        )
      ) : (
        <>
          <Card gap={8} testID="league-head">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt v="sm" bold style={{ flex: 1 }}>
                {leagueLine(data)}
              </Txt>
              <Pill tone={data.phase === 'open' ? 'good' : undefined}>
                {leaguePhaseLabel(data.phase)}
              </Pill>
            </View>
            <Txt v="sm" tone="muted">
              {L.pitch}
            </Txt>
            {/* 접수 중에는 위 한 줄에 신청 수가 있다. */}
            {data.phase !== 'soon' && data.phase !== 'open' ? (
              <Txt v="xs" tone="muted">
                {L.entries({ n: data.entries })}
              </Txt>
            ) : null}
          </Card>
          <EntryCard data={data} me={me} linked={linked} reload={() => reload(true)} />
          {pick && data.tiers ? (
            <>
              <LeaguePicker
                choices={leagueChoices(data)}
                pick={pick}
                mine={mine}
                onpick={(x) => {
                  picked.current = true;
                  setPick(x);
                }}
              />
              <LeagueBoard
                season={data.league.season}
                pick={pick}
                bottomTier={data.tiers.at(-1)?.tier ?? 1}
                mineId={mineId}
                round={round}
                setRound={setRound}
                onopen={(m, table) => {
                  setDetail({ m, table });
                  scrollTo(0);
                }}
              />
            </>
          ) : null}
          <Card gap={8} testID="league-schedule">
            <Txt v="h3" bold accessibilityRole="header">
              {L.scheduleTitle}
            </Txt>
            {leagueSchedule(data.league).map((r) => (
              <Kv key={r.label} k={r.label} v={r.text} />
            ))}
          </Card>
          <Card gap={8} testID="league-rules">
            <Txt v="h3" bold accessibilityRole="header">
              {L.rulesTitle}
            </Txt>
            {leagueRules().map((r) => (
              <Bullet key={r}>{r}</Bullet>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
