// T-11-669 은퇴 화면 실험군(웹 RetireExp.svelte): 리포트 맨 위에 저장된 시즌 기록의 대표 장면(최대 3개)과, 방금 은퇴한
// 선수가 내 구단에서 어떻게 쓰이는지 다음 행동 하나. 선정 · 판정 · 문구는 app-core(retireExperiment · retireExperimentView).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import { onUploadStatus, retirementUploadStatus } from '@offside/app-core/outboxStore';
import {
  retireNextStep,
  type RetireAccount,
  type RetireCta,
  type RetireScene,
  type RetireSceneKind,
} from '@offside/app-core/retireExperiment';
import {
  retireCtaLabel,
  retireNextText,
  retireSceneView,
} from '@offside/app-core/retireExperimentView';
import { retireExpText as L } from '@offside/app-core/i18n/ko/retireExp';
import { useColors } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

export function RetireExp({
  cid,
  pos,
  scenes,
  account,
  onScene,
  onCta,
}: {
  cid: string;
  pos: string;
  scenes: RetireScene[];
  account: RetireAccount;
  onScene: (kind: RetireSceneKind) => void;
  onCta: (cta: RetireCta) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState<RetireSceneKind | null>(null);
  // 기기 안 업로드 큐만 읽는다(서버에 묻지 않는다). 큐가 바뀌면 안내도 바뀐다.
  const [, setTick] = useState(0);
  useEffect(() => onUploadStatus(() => setTick((t) => t + 1)), []);
  const next = retireNextStep(account, retirementUploadStatus(cid).state);
  const views = scenes.map((s) => retireSceneView(s, pos));
  const toggle = (kind: RetireSceneKind) => {
    if (open !== kind) onScene(kind);
    setOpen(open === kind ? null : kind);
  };
  return (
    <Card testID="retire-exp" style={{ marginBottom: 16 }}>
      {views.length ? (
        <>
          <View>
            <Txt v="eyebrow">{L.eyebrow}</Txt>
            <Txt v="h2" accessibilityRole="header">
              {L.title}
            </Txt>
          </View>
          <View style={{ gap: 8 }}>
            {views.map((s) => (
              <View
                key={s.kind}
                testID={`retire-scene-${s.kind}`}
                style={{ borderWidth: 1, borderColor: c.line, borderRadius: RADIUS.md }}
              >
                <Press
                  testID="retire-scene"
                  accessibilityState={{ expanded: open === s.kind }}
                  onPress={() => toggle(s.kind)}
                  style={{ paddingVertical: 10, paddingHorizontal: 12, minHeight: 44 }}
                  scale={0.985}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Txt bold style={{ flexShrink: 1 }}>
                      {s.title}
                    </Txt>
                    <Txt v="sm" tone="muted">
                      {open === s.kind ? L.close : L.open}
                    </Txt>
                  </View>
                  <Txt v="sm" tone="muted">
                    {s.when}
                  </Txt>
                  <Txt>
                    {s.stats}
                    {s.rating ? ` · ${s.rating}` : ''}
                  </Txt>
                </Press>
                {open === s.kind ? (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                    <Txt v="sm">{s.detail}</Txt>
                    {s.honors ? <Txt v="sm">{s.honors}</Txt> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <Txt v="xs" tone="muted">
            {L.note}
          </Txt>
        </>
      ) : null}
      <View testID={`retire-next-${next.kind}`} style={{ gap: 4 }}>
        <Txt v="eyebrow">{L.nextEyebrow}</Txt>
        <Txt v="h3">{L.nextTitle}</Txt>
        <Txt v="sm" tone="muted">
          {retireNextText(next.kind)}
        </Txt>
        {next.cta ? (
          <Btn kind="primary" block testID="retire-next" onPress={() => onCta(next.cta!)}>
            {retireCtaLabel(next.cta)}
          </Btn>
        ) : null}
      </View>
    </Card>
  );
}
