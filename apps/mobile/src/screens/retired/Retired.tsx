// 은퇴 직후 화면(웹 Retired.svelte, ui.ts renderRetired() 포트). 리포트 본문은 LegendReport.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSnapshot } from 'valtio';
import { latestBalance } from '@offside/game/balance';
import { retirementUploadStatus } from '@offside/app-core/outboxStore';
import {
  pickRetireScenes,
  profileKey,
  retireAccount,
  retireArm,
  retireExpShare,
  type RetireArm,
  type RetireCta,
  type RetireScene,
} from '@offside/app-core/retireExperiment';
import { accountFresh, accountGeneration, freshAccount, viewFromGame } from '../../game/host';
import { go, goHome, goNew } from '../../game/nav';
import { loadHOF } from '@offside/game/hof-store';
import { accountCache, appState } from '../../store';
import { retireExp } from '../../analytics';
import { Btn } from '../../ui/Btn';
import { Topbar } from '../../ui/Topbar';
import { CreditScreen } from './credit';
import { LegendReport } from './LegendReport';
import { RetiredAdSlot } from './RetiredAdSlot';
import { OwnHofCards } from './OwnHofCards';
import { PushAskCard } from '../../components/PushAskCard';
import { RetireExp } from './RetireExp';
import { RetireCohort } from './RetireCohort';
import { ShareBar } from './ShareBar';
import { retiredText as L } from '@offside/app-core/i18n/ko/retired';

/**
 * T-11-669 은퇴 화면 실험(기본 꺼짐, 웹 Retired.svelte와 같은 규칙). 서버 최신 밸런스의 retireExpShare가 0이면 아무것도
 * 하지 않는다(계정도 묻지 않는다). 켜져 있으면 프로필 ID로 고정 배정하고 실험군만 맨 위 대표 장면 · 다음 행동을 본다.
 */
function useRetireExperiment(cid: string, firstRetire: boolean) {
  const t0 = useRef(Date.now());
  const [arm, setArm] = useState<RetireArm | null>(null);
  const [scenes, setScenes] = useState<RetireScene[]>([]);
  const st = useRef({ left: false, interacted: false, arm: null as RetireArm | null });
  const { value: profile } = useSnapshot(accountCache);
  const account = retireAccount(profile as typeof accountCache.value);

  useEffect(() => {
    const share = retireExpShare(latestBalance());
    if (share <= 0 || !cid) return;
    let alive = true;
    void (async () => {
      // 처음이거나 5분 지난 캐시면 다시 확인이 끝날 때까지(최대 3초) 기다린다. 못 받았거나 옛 캐시만 남았거나
      // ID가 없으면 실험 밖(지금 화면, 계측 없음).
      await Promise.race([freshAccount(), new Promise((r) => setTimeout(r, 3000))]);
      const gen = accountGeneration();
      if (!alive || !accountFresh()) return;
      const p = accountCache.value;
      const id = p && p !== 'error' ? p.id : null;
      const a = retireArm(id, share);
      if (!a || !id) return;
      let picked: RetireScene[] = [];
      try {
        picked = pickRetireScenes(appState.G?.career ?? []);
      } catch {
        retireExp.error(a, 'scenes');
      }
      if (gen !== accountGeneration()) return;
      st.current.arm = a;
      setScenes(picked);
      setArm(a);
      requestAnimationFrame(() => {
        if (!alive) return;
        // 이용 분석 · SDK가 아직 준비되지 않았으면 준비될 때 노출을 보낸다(그 전 클릭은 보내지 않는다).
        retireExp.view({
          arm: a,
          cid,
          order: firstRetire ? 'first' : 'repeat',
          upload: retirementUploadStatus(cid).state,
          account: retireAccount(accountCache.value),
          scenes: picked.length,
          readyMs: Date.now() - t0.current,
          pk: profileKey(id)!,
        });
      });
    })();
    const sub = AppState.addEventListener('change', (next) => {
      const s = st.current;
      if (next !== 'background' || !s.arm || s.left) return;
      s.left = true;
      retireExp.leave(s.arm, {
        dwellMs: Date.now() - t0.current,
        interacted: s.interacted,
        via: 'hide',
      });
    });
    return () => {
      alive = false;
      sub.remove();
      const s = st.current;
      if (s.arm && !s.left)
        retireExp.leave(s.arm, {
          dwellMs: Date.now() - t0.current,
          interacted: s.interacted,
          via: 'nav',
        });
      else retireExp.end();
    };
  }, [cid, firstRetire]);

  const touched = () => {
    st.current.interacted = true;
  };
  return { arm, scenes, account, touched };
}

export default function Retired() {
  const snap = useSnapshot(appState);
  const hasG = !!snap.G;
  // 스냅숏(snap.G)이 바뀔 때만 다시 만든다 — viewFromGame은 원본 세이브를 읽는다.
  const v = useMemo(() => (hasG ? viewFromGame(appState.G!) : null), [snap.G]);
  // T-11-611 첫 은퇴에만 내 구단으로 가는 길을 함께 보여 준다(서버 요청 없이 기기 기록으로 판단).
  const firstRetire = useMemo(() => loadHOF().length <= 1, []);
  const cid = appState.G?.cid ?? '';
  const exp = useRetireExperiment(cid, firstRetire);
  if (!v) return null;
  const onCta = (cta: RetireCta) => {
    exp.touched();
    if (exp.arm) retireExp.cta(exp.arm, cta);
    if (cta === 'team') {
      appState.teamView = 'team';
      go('team');
    } else go('owner');
  };
  return (
    <CreditScreen footer={v.shareId ? <ShareBar id={v.shareId} /> : null}>
      <Topbar />
      {exp.arm === 'treatment' ? (
        <RetireExp
          cid={cid}
          pos={appState.G?.pos ?? ''}
          scenes={exp.scenes}
          account={exp.account}
          onScene={(k) => {
            exp.touched();
            retireExp.scene('treatment', k);
          }}
          onCta={onCta}
        />
      ) : null}
      {/* T-11-675 같은 시즌 · 같은 포지션 은퇴 선수 중 내 기록의 자리(분포가 있을 때만). */}
      <RetireCohort v={v} />
      {/* T-10-029: 명예의 전당 공개·다음 버튼은 크레딧 맨 아래에, 공유 버튼은 화면 아래에 고정된다(T-10-067). */}
      <LegendReport
        v={v}
        fresh={appState.G?.cid}
        end={
          <>
            {v.own?.id ? <OwnHofCards v={v} /> : null}
            <PushAskCard />
            <Btn
              kind="primary"
              block
              testID="new"
              onPress={() => {
                exp.touched();
                goNew();
              }}
            >
              {L.newCareer}
            </Btn>
            {/* T-11-669 실험군은 맨 위 다음 행동이 내 구단 길을 맡으므로 같은 버튼을 두 번 두지 않는다. */}
            {firstRetire && exp.arm !== 'treatment' ? (
              <Btn
                block
                testID="my-club"
                onPress={() => {
                  exp.touched();
                  if (exp.arm === 'control') retireExp.cta('control', 'legacy_club');
                  go('owner');
                }}
              >
                {L.myClub}
              </Btn>
            ) : null}
            <Btn
              block
              testID="home"
              onPress={() => {
                exp.touched();
                goHome();
              }}
            >
              {L.seeHof}
            </Btn>
          </>
        }
      />
      <RetiredAdSlot />
    </CreditScreen>
  );
}
