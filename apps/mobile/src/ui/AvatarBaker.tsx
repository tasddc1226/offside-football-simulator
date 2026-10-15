// T-11-270 화면 밖에서 선수 그림을 하나씩 층으로 그려 PNG 파일로 찍는다(avatarBake 대기열).
// 공유 카드와 같은 방식(화면 밖 상자 + captureRef)이라 새 네이티브 모듈이 필요 없다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AvatarLayers } from './ImageAvatar';
import { finishBake, nextBake, useBakeQueue, type BakeJob } from './avatarBake';

/** 그림 계획 1칸당 화면 밖 상자 크기(dp)와 찍는 픽셀. 큰 화면(은퇴 리포트 · 꾸미기)에서도 흐려지지 않게 둔다. */
const DP = 8;
const PX = 16;
/** 그림 받기가 이보다 오래 걸리면 굽기를 포기하고 층을 직접 그린다. */
const TIMEOUT_MS = 10_000;

export function AvatarBaker() {
  const tick = useBakeQueue();
  const [job, setJob] = useState<BakeJob>();
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!job) setJob(nextBake());
  }, [tick, job]);
  const finish = useCallback((key: string, uri: string | undefined) => {
    finishBake(key, uri);
    setJob(undefined);
  }, []);
  useEffect(() => {
    if (!job) return;
    const t = setTimeout(() => finish(job.key, undefined), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [job, finish]);
  const onReady = useCallback(
    (ready: boolean) => {
      if (!ready || !job) return;
      const { key, plan } = job;
      // 층이 실제로 그려진 다음 프레임에 찍는다.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          captureRef(ref, {
            format: 'png',
            result: 'tmpfile',
            width: plan.width * PX,
            height: plan.height * PX,
          }).then(
            (uri) => finish(key, uri),
            () => finish(key, undefined),
          );
        }),
      );
    },
    [job, finish],
  );
  if (!job) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: -10000, top: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        key={job.key}
        ref={ref}
        collapsable={false}
        style={{ width: job.plan.width * DP, height: job.plan.height * DP }}
      >
        <AvatarLayers plan={job.plan} width={job.plan.width * DP} onReady={onReady} />
      </View>
    </View>
  );
}
