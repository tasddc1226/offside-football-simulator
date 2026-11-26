// T-11-834 크리스마스 이벤트 카드(웹 HomeXmas.svelte). 양말 세 개(첫 시즌 · 은퇴 · 구단주 팀)와 모두가 채우는 트리 입구.
// 기기 시계로 기간(12/19~1/4 KST) 안일 때만 Home.tsx가 그리고, 상태는 app-core api/xmas.ts의 5분 메모 한 번이다.
// 받기는 로그인한 구단주만 — 로그인 전이면 같은 창에서 로그인 버튼을 보인다. 그리는 값은 app-core xmas-view.ts(웹과 같다).
import { RADIUS } from '@offside/app-core/design-tokens';
import { claimXmas, fetchXmas } from '@offside/app-core/api/xmas';
import { xmasText as L } from '@offside/app-core/i18n/ko/xmas';
import {
  sockHint,
  sockLabel,
  sockState,
  sockStateLabel,
  treeCountText,
  treePct,
  xmasClaimToast,
  xmasDaysLeft,
  xmasRewardText,
  type XmasSockState,
} from '@offside/app-core/xmas-view';
import type { XmasEvent, XmasSock } from '@offside/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { toast } from '../../game/host';
import { go, goContinue, goNew } from '../../game/nav';
import { playSfx } from '../../platform/sfx';
import { appState } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Row, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';
import { useOnPull } from '../../ui/refresh';
import { LoginButtons } from '../owner/LoginButtons';
import sockBig from '../../../assets/images/xmas/sock-big.png';
import sockMedium from '../../../assets/images/xmas/sock-medium.png';
import sockSmall from '../../../assets/images/xmas/sock-small.png';
import TREE from '../../../assets/images/xmas/tree.png';

const RED = '#C8654F';
const GOLD = '#D7AF54';
const IMG = { start: sockSmall, retire: sockMedium, team: sockBig };

function Bar({ pct, h = 8 }: { pct: number; h?: number }) {
  const c = useColors();
  return (
    <View
      style={{
        height: h,
        borderRadius: h,
        overflow: 'hidden',
        backgroundColor: alpha(c.muted, 0.18),
      }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: h, backgroundColor: GOLD }} />
    </View>
  );
}

export function HomeXmas() {
  const c = useColors();
  const [ev, setEv] = useState<XmasEvent | null>(null);
  const [sheet, setSheet] = useState<'tree' | XmasSock['key'] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // 응답을 못 받아 다시 누르면 같은 키로 보내 두 번 받지 않는다. 받기가 끝나면 새 키로 바꾼다.
  const keys = useRef(new Map<string, string>());
  const reload = useCallback(async () => setEv(await fetchXmas()), []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useOnPull(reload);
  if (!ev) return null;
  const pct = treePct(ev);
  const sock = sheet && sheet !== 'tree' ? ev.socks.find((s) => s.key === sheet) : undefined;

  const claim = async (target: string) => {
    if (busy) return;
    setBusy(target);
    const key = keys.current.get(target) ?? crypto.randomUUID();
    keys.current.set(target, key);
    const r = await claimXmas(target, key);
    setBusy(null);
    if (r.ok) {
      keys.current.delete(target);
      playSfx('reward');
      setEv(r.data.event);
      toast(xmasClaimToast(target, r.data.granted, r.data.title));
      if (target.startsWith('sock:')) setSheet(null);
    } else if (r.error.reason === 'XMAS_CLOSED') {
      keys.current.delete(target);
      setEv(null);
      toast(r.error.message);
    } else if (r.error.reason === 'XMAS_CLAIMED' || r.error.reason === 'XMAS_NOT_READY') {
      keys.current.delete(target);
      await reload();
      if (r.error.reason === 'XMAS_NOT_READY') toast(r.error.message);
    } else toast(L.fail);
  };

  const tapSock = (s: XmasSock) => {
    if (sockState(ev, s) === 'ready') void claim(`sock:${s.key}`);
    else setSheet(s.key);
  };

  const goDo = (key: XmasSock['key']) => {
    setSheet(null);
    if (key === 'team') go('owner');
    else if (appState.G && !appState.G.retired) goContinue();
    else goNew();
  };

  const chip = (st: XmasSockState) =>
    st === 'ready'
      ? { bg: RED, fg: '#FFFFFF' }
      : st === 'login'
        ? { bg: alpha(c.accent, 0.14), fg: c.accent }
        : { bg: alpha(c.muted, 0.12), fg: st === 'claimed' ? c.accent : c.muted };

  return (
    <>
      <Card testID="home-xmas" style={{ gap: 12, borderWidth: 1, borderColor: alpha(RED, 0.35) }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="eyebrow" style={{ color: RED }}>
              {L.until}
            </Txt>
            <Txt bold>{L.title}</Txt>
            <Txt v="sm" tone="muted">
              {L.sub}
            </Txt>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: RADIUS.pill,
              backgroundColor: RED,
            }}
          >
            <Txt v="xs" bold num style={{ color: '#FFFFFF' }}>
              {L.dday({ n: xmasDaysLeft() })}
            </Txt>
          </View>
        </Row>
        <Row style={{ gap: 8 }}>
          {ev.socks.map((s) => {
            const st = sockState(ev, s);
            const ch = chip(st);
            return (
              <Press
                key={s.key}
                testID={`xmas-sock-${s.key}`}
                accessibilityRole="button"
                accessibilityLabel={`${sockLabel(s.key)}, ${xmasRewardText(s.reward)}, ${sockStateLabel(st)}`}
                disabled={busy === `sock:${s.key}`}
                onPress={() => tapSock(s)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 4,
                  paddingTop: 10,
                  paddingBottom: 8,
                  paddingHorizontal: 4,
                  borderRadius: 14,
                  borderWidth: st === 'ready' ? 2 : 1,
                  borderColor: st === 'ready' ? RED : c.line,
                  backgroundColor: alpha(c.surface, 0.8),
                }}
              >
                <Image
                  source={IMG[s.key]}
                  style={{
                    width: 56,
                    height: 56,
                    opacity: st === 'todo' ? 0.55 : 1,
                  }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
                <Txt v="xs" bold center>
                  {sockLabel(s.key)}
                </Txt>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 1,
                    borderRadius: RADIUS.pill,
                    backgroundColor: ch.bg,
                  }}
                >
                  <Txt v="xs" bold={st === 'ready'} style={{ color: ch.fg }}>
                    {`${st === 'claimed' ? '✓ ' : ''}${sockStateLabel(st)}`}
                  </Txt>
                </View>
              </Press>
            );
          })}
        </Row>
        <Press
          testID="xmas-tree"
          accessibilityRole="button"
          accessibilityLabel={`${L.treeTitle}, ${L.treeEntry({ pct })}`}
          onPress={() => setSheet('tree')}
          style={{ gap: 6 }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="sm" bold>
              {L.treeTitle}
            </Txt>
            <Txt v="sm" num>
              {L.treeEntry({ pct })} ›
            </Txt>
          </Row>
          <Bar pct={pct} />
        </Press>
      </Card>
      {sheet === 'tree' ? (
        <PopSheet label={L.treeTitle} testID="xmas-tree-sheet" onClose={() => setSheet(null)}>
          <Txt v="h3" bold accessibilityRole="header">
            {L.treeTitle}
          </Txt>
          <Image
            source={TREE}
            style={{
              width: 180,
              height: 180,
              alignSelf: 'center',
              opacity: 0.55 + (pct / 100) * 0.45,
            }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Txt v="sm">{ev.tree.counting ? L.treeLead : L.treeClosed}</Txt>
          <Bar pct={pct} h={12} />
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <Txt v="sm" num>
              {treeCountText(ev)}
            </Txt>
            <Txt v="sm" tone="muted" num>
              {L.treeMine({ n: ev.tree.mine })}
            </Txt>
          </Row>
          <View style={{ gap: 6 }}>
            {ev.tree.steps.map((step, i) => {
              const target = `tree:${i + 1}`;
              return (
                <View
                  key={step.pct}
                  testID={`xmas-step-${i + 1}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: step.reached ? alpha(GOLD, 0.6) : c.line,
                  }}
                >
                  <Txt bold num style={{ width: 44 }}>
                    {`${step.pct}%`}
                  </Txt>
                  <Txt v="sm" style={{ flex: 1 }}>
                    {xmasRewardText(step.reward)}
                  </Txt>
                  {step.claimed ? (
                    <Txt v="xs" tone="good">{`✓ ${L.stateClaimed}`}</Txt>
                  ) : step.reached && ev.owner ? (
                    <Btn
                      sm
                      kind="accent"
                      testID="xmas-tree-claim"
                      disabled={busy === target}
                      onPress={() => void claim(target)}
                    >
                      {L.stateReady}
                    </Btn>
                  ) : (
                    <Txt v="xs" tone="muted">
                      {step.reached ? L.stepReached : L.stepLocked}
                    </Txt>
                  )}
                </View>
              );
            })}
          </View>
          {!ev.owner ? (
            <>
              <Txt v="sm" tone="muted">
                {L.loginLead}
              </Txt>
              <LoginButtons place="home" back={{ home: true }} onDone={() => void reload()} />
            </>
          ) : null}
          <Btn block testID="xmas-close" onPress={() => setSheet(null)}>
            {L.close}
          </Btn>
        </PopSheet>
      ) : sock ? (
        <PopSheet
          label={sockLabel(sock.key)}
          testID={`xmas-sock-sheet-${sock.key}`}
          onClose={() => setSheet(null)}
        >
          <Image
            source={IMG[sock.key]}
            style={{ width: 96, height: 96, alignSelf: 'center' }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Txt v="h3" bold accessibilityRole="header">
            {sockLabel(sock.key)}
          </Txt>
          <Txt v="sm">{sockHint(sock.key)}</Txt>
          <Txt v="sm" bold>
            {xmasRewardText(sock.reward)}
          </Txt>
          {sockState(ev, sock) === 'login' ? (
            <>
              <Txt v="sm" tone="muted">
                {L.loginLead}
              </Txt>
              <LoginButtons place="home" back={{ home: true }} onDone={() => void reload()} />
            </>
          ) : sockState(ev, sock) === 'todo' ? (
            <>
              {!ev.owner ? (
                <Txt v="sm" tone="muted">
                  {L.loginLead}
                </Txt>
              ) : null}
              <Btn kind="accent" block testID="xmas-go" onPress={() => goDo(sock.key)}>
                {sock.key === 'team'
                  ? L.goTeam
                  : appState.G && !appState.G.retired
                    ? L.goCareer
                    : L.goStart}
              </Btn>
            </>
          ) : sockState(ev, sock) === 'claimed' ? (
            <Txt v="sm" tone="good">{`✓ ${L.stateClaimed}`}</Txt>
          ) : null}
          <Btn block testID="xmas-close" onPress={() => setSheet(null)}>
            {L.close}
          </Btn>
        </PopSheet>
      ) : null}
    </>
  );
}
