// T-11-511 시즌 패스(내 구단 화면 '시즌 패스' 칸으로 연다, 웹 owner/SeasonPass.svelte). 열 때 한 번 패스 상태(1분 메모)를
// 받고, 서버가 이 스토어에서 팔면 스토어 가격을 묻는다. 산 패스의 열린 단계 보상을 받는다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SeasonPassResponse, SeasonPassSeason } from '@offside/contracts';
import { claimSeasonPassReward, fetchSeasonPass } from '@offside/app-core/api/seasonPass';
import { rewardText } from '@offside/app-core/attendance-view';
import { RADIUS } from '@offside/app-core/design-tokens';
import { needsOwnerLogin } from '@offside/app-core/market';
import {
  PASS_RULE,
  PASS_TIER_COUNT,
  passClaimable,
  passNext,
  passTiers,
  passTotalText,
} from '@offside/app-core/season-pass-view';
import { seasonPassText as L } from '@offside/app-core/i18n/ko/seasonPass';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { buySeasonPass, seasonPassStore, syncSeasonPassStore } from '../../platform/seasonPass';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, PitchCard, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';

function Track({
  s,
  busy,
  onClaim,
}: {
  s: SeasonPassSeason;
  busy: boolean;
  onClaim: (s: SeasonPassSeason) => void;
}) {
  const c = useColors();
  const next = passNext(s);
  const count = L.tierCount({ tier: s.tier, total: PASS_TIER_COUNT });
  return (
    <View style={{ gap: 8 }}>
      <PitchCard gap={10}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Txt tone="onPitch" bold>
            {L.seasonTitle({ season: s.season })}
          </Txt>
          <Txt tone={s.owned ? 'pitchAccent' : 'onPitch'} bold style={{ fontSize: rem(0.75) }}>
            {s.owned ? L.owned : count}
          </Txt>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={count}
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.25)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${(s.tier / PASS_TIER_COUNT) * 100}%`,
              height: '100%',
              backgroundColor: c.pitchAccent,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Txt tone="onPitch" style={{ fontSize: rem(0.875) }}>
            {L.progress({ n: s.progress })}
          </Txt>
          <Txt
            tone="onPitch"
            style={{ fontSize: rem(0.875), opacity: 0.75, flexShrink: 1, textAlign: 'right' }}
          >
            {next ? L.next(next) : L.allOpen}
          </Txt>
        </View>
      </PitchCard>
      {passTiers(s).map((t) => {
        const state =
          t.state === 'claimed' ? L.stateClaimed : t.state === 'open' ? L.stateOpen : L.stateLocked;
        return (
          <View
            key={t.tier}
            accessible
            accessibilityLabel={L.tierLabel({
              tier: t.tier,
              need: t.need,
              reward: t.reward,
              state,
            })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: t.state === 'open' ? c.accent : c.line,
              backgroundColor: c.surface,
              opacity: t.state === 'locked' ? 0.6 : 1,
            }}
          >
            <Txt
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(1.2),
                minWidth: 24,
                textAlign: 'center',
              }}
            >
              {t.tier}
            </Txt>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt>{t.reward}</Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                {L.tierNeed({ n: t.need })}
              </Txt>
            </View>
            <Txt
              bold
              tone={t.state === 'claimed' ? 'good' : t.state === 'open' ? 'accent' : 'muted'}
              style={{ fontSize: rem(0.75) }}
            >
              {state}
            </Txt>
          </View>
        );
      })}
      {passClaimable(s) ? (
        <Btn kind="primary" block testID="pass-claim" disabled={busy} onPress={() => onClaim(s)}>
          {busy ? L.claimBusy : L.claim}
        </Btn>
      ) : null}
    </View>
  );
}

export function SeasonPass({ onClose }: { onClose: () => void }) {
  const store = useSnapshot(seasonPassStore);
  const [pass, setPass] = useState<SeasonPassResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus | 'login'>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const key = useRef<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await fetchSeasonPass();
    if (!r.ok) return setStatus(needsOwnerLogin(r.error) ? 'login' : 'error');
    setPass(r.data);
    setStatus('ready');
    void syncSeasonPassStore(r.data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // 결제가 끝나 서버가 패스를 열면 그 상태로 바꾼다.
  useEffect(() => {
    if (store.pass) setPass(seasonPassStore.pass);
  }, [store.pass]);

  const claim = async (s: SeasonPassSeason) => {
    if (busy) return;
    setBusy(true);
    key.current ??= crypto.randomUUID();
    const r = await claimSeasonPassReward(s.season, key.current);
    setBusy(false);
    if (!r.ok)
      return setNote({
        ok: false,
        text: r.error.retryable ? L.claimFail : r.error.message || L.claimFail,
      });
    key.current = null;
    setPass(r.data.pass);
    const got = rewardText(r.data.granted);
    setNote(got ? { ok: true, text: L.got({ reward: got }) } : { ok: false, text: L.nothing });
  };

  const current = pass?.seasons[0] ?? null;
  const past = pass?.seasons.filter((s) => current && s.season < current.season) ?? [];
  const ahead = pass?.seasons.filter((s) => current && s.season > current.season) ?? [];
  const c = useColors();

  return (
    <PopSheet label={L.title} step={pass ? 'pass' : 'load'} testID="season-pass" onClose={onClose}>
      <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="h2" style={{ flex: 1 }}>
            {L.title}
          </Txt>
          <Btn sm testID="pass-close" onPress={onClose}>
            {L.back}
          </Btn>
        </View>
        {status === 'login' ? (
          <Txt>{L.login}</Txt>
        ) : (
          <LoadState status={status} failText={L.loadFail} retry={() => void load()} rows={6}>
            {pass && current ? (
              <View style={{ gap: 12 }}>
                {note ? (
                  <View
                    style={{ padding: 12, borderRadius: RADIUS.md, backgroundColor: c.surface2 }}
                  >
                    <Txt tone={note.ok ? 'good' : 'ink'} accessibilityRole="alert">
                      {note.text}
                    </Txt>
                  </View>
                ) : null}
                <Txt style={{ fontSize: rem(0.875) }}>{L.lead}</Txt>
                <Track s={current} busy={busy} onClaim={(s) => void claim(s)} />
                {!current.owned ? (
                  store.price ? (
                    <View style={{ gap: 6 }}>
                      <Btn
                        kind="accent"
                        block
                        testID="pass-buy"
                        disabled={store.busy}
                        onPress={() => void buySeasonPass()}
                      >
                        {store.busy ? L.buyBusy : L.buy({ price: store.price })}
                      </Btn>
                      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                        {L.buyHint}
                      </Txt>
                    </View>
                  ) : !pass.onSale ? (
                    <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                      {L.notOnSale}
                    </Txt>
                  ) : null
                ) : null}
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {`${L.rule(PASS_RULE)} ${L.midSeason} ${L.once}`}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {L.total({ reward: passTotalText() })}
                </Txt>
                {ahead.map((s) => (
                  <View
                    key={s.season}
                    style={{
                      gap: 4,
                      padding: 12,
                      borderRadius: RADIUS.md,
                      backgroundColor: c.surface2,
                    }}
                  >
                    <Txt bold>{L.aheadTitle({ season: s.season })}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                      {L.aheadLead}
                    </Txt>
                  </View>
                ))}
                {past.length ? (
                  <View style={{ gap: 8 }}>
                    <Txt bold>{L.pastTitle}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                      {L.pastLead}
                    </Txt>
                    {past.map((s) => (
                      <Track key={s.season} s={s} busy={busy} onClaim={(x) => void claim(x)} />
                    ))}
                  </View>
                ) : null}
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {L.useHint}
                </Txt>
              </View>
            ) : null}
          </LoadState>
        )}
      </View>
    </PopSheet>
  );
}
