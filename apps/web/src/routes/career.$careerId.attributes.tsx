// SCR-033 능력치 상세: Base OVR을 구성하는 세부 능력·역할 가중치·역할별 OVR 미리보기·포지션
// 숙련도·정찰 범위·시즌 변화 원인을 본다. 계약 전에도 열린다(전술실 링크만 계약 뒤). 진짜 잠재력은
// 어디에도 쓰지 않는다.
import { useEffect } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, ScreenIntro, Tabs, TabsContent, TabsList, TabsTrigger } from '@offside/ui';
import { computeBaseOvr } from '@offside/domain';
import { rulesetForCareer } from '../engine/content.js';
import { careerQueryOptions, useCareer } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import {
  archetypesSharingPosition,
  ATTRIBUTE_GROUP_LABEL_KO,
  attributeGroups,
  previewBaseOvr,
  roleWeightPercentEntries,
} from '../shared/attribute-groups.js';
import { ATTRIBUTE_LABELS, POSITION_LABELS } from '../shared/labels.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { ATTRIBUTE_CHANGE_CAUSE_LABEL_KO, latestSeasonResult } from '../shared/season-result.js';
import { platform } from '../platform/index.js';

export const Route = createFileRoute('/career/$careerId/attributes')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    if (state.status !== 'ACTIVE') {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: AttributesScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const NUM_LG_STYLE = {
  fontSize: 'var(--os-fs-num-lg)',
  lineHeight: 'var(--os-lh-num-lg)',
} as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function AttributesScreen() {
  const { careerId } = Route.useParams();
  const navigate = useNavigate();
  const query = useCareer(careerId);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-033',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;
  const { state } = query.data;
  const profile = state.player.profile;
  if (profile === null) return null; // 라우트 loader가 ACTIVE를 보장하지만(=profile 존재), 방어적 fallback.
  const ruleset = rulesetForCareer(state);

  const currentArchetype = ruleset.archetypes.find(
    (candidate) => candidate.id === profile.archetypeId,
  );
  if (currentArchetype === undefined) return null;

  const computedBaseOvr = computeBaseOvr(state.attributes, currentArchetype.roleWeights);
  const roleWeightPercents = roleWeightPercentEntries(currentArchetype.roleWeights);
  const previewCandidates = archetypesSharingPosition(ruleset, profile.primaryPosition);
  const defaultPreviewId = previewCandidates.some(
    (candidate) => candidate.id === profile.archetypeId,
  )
    ? profile.archetypeId
    : (previewCandidates[0]?.id ?? profile.archetypeId);

  const seasonResult = latestSeasonResult(state);

  function seasonChangeText(key: string): string {
    if (seasonResult === null) return '—';
    const entry = seasonResult.attributeDeltas.find((candidate) => candidate.key === key);
    if (entry === undefined) return '—';
    const sign = entry.delta >= 0 ? '+' : '';
    const causes = entry.causes.map((cause) => ATTRIBUTE_CHANGE_CAUSE_LABEL_KO[cause]).join('·');
    return `${sign}${entry.delta} (${causes})`;
  }

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: '/career/$careerId', params: { careerId } });
  }

  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="PLAYER REPORT"
        title="능력치 상세"
        description={`${profile.name}의 현재 실력과 성장 기록을 살펴보세요.`}
      />

      <section className="os-panel flex flex-col gap-os-2">
        <p className="os-eyebrow">
          {currentArchetype.name} · {POSITION_LABELS[profile.primaryPosition]}
        </p>
        <p className="os-num font-os font-bold text-os-accent" style={NUM_LG_STYLE}>
          Base OVR {profile.baseOvr}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          표시된 능력 × 가중치 = {computedBaseOvr}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          현재 역할에 필요한 능력의 비중을 반영한 종합 실력입니다.
        </p>
      </section>

      {attributeGroups().map((group) => (
        <section
          key={group.id}
          className="flex flex-col gap-os-4 border-t border-os-border pt-os-4"
          aria-labelledby={`attribute-group-${group.id}`}
        >
          <h2
            id={`attribute-group-${group.id}`}
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            {ATTRIBUTE_GROUP_LABEL_KO[group.id]}
          </h2>
          <dl className="grid grid-cols-2 gap-os-2">
            {group.keys.map((key) => {
              const weightEntry = roleWeightPercents.find((entry) => entry.key === key);
              return (
                <div
                  key={key}
                  className="flex min-w-0 flex-col gap-os-1 rounded-os-m bg-os-surface-2 p-os-3"
                >
                  <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
                    {ATTRIBUTE_LABELS[key]}
                    {weightEntry ? ` · 가중치 ${weightEntry.percent}%` : ''}
                  </dt>
                  <dd className="os-num font-os font-semibold text-os-text" style={NUM_LG_STYLE}>
                    {state.attributes[key]}
                  </dd>
                  <dd className="font-os text-os-text-2" style={CAPTION_STYLE}>
                    시즌 변화 {seasonChangeText(key)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      {previewCandidates.length > 0 ? (
        <section className="flex flex-col gap-os-3 border-t border-os-border pt-os-4">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
            역할별 OVR 미리보기
          </h2>
          <Tabs defaultValue={defaultPreviewId}>
            <TabsList aria-label="역할별 OVR 미리보기">
              {previewCandidates.map((archetype) => (
                <TabsTrigger key={archetype.id} value={archetype.id}>
                  {archetype.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {previewCandidates.map((archetype) => (
              <TabsContent key={archetype.id} value={archetype.id}>
                <p className="os-num font-os font-semibold text-os-text" style={BODY_STYLE}>
                  OVR {previewBaseOvr(state.attributes, archetype)}
                </p>
                <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                  {roleWeightPercentEntries(archetype.roleWeights)
                    .map((entry) => `${ATTRIBUTE_LABELS[entry.key]} ${entry.percent}%`)
                    .join(' · ')}
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : null}

      <section className="flex flex-col gap-os-2 border-t border-os-border pt-os-4">
        <p className="font-os text-os-text" style={BODY_STYLE}>
          포지션({POSITION_LABELS[profile.primaryPosition]}) 숙련도:{' '}
          {state.context.positionProficiency}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          정찰 범위: {profile.scoutedPotentialMin}~{profile.scoutedPotentialMax}
        </p>
      </section>

      <div className="os-action-dock">
        <Button variant="secondary" onClick={handleBack}>
          이전
        </Button>
      </div>
    </div>
  );
}
