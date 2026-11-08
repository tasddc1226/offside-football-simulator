<script lang="ts">
  // T-11-669 은퇴 화면 실험군: 리포트 맨 위에 저장된 시즌 기록의 대표 장면(최대 3개)과, 방금 은퇴한 선수가 내 구단에서
  // 어떻게 쓰이는지 다음 행동 하나. 실험군일 때만 불러오는 청크다(대조군 · 실험 밖은 이 파일을 받지 않는다).
  // 앱은 screens/retired/RetireExp.tsx. 선정 · 판정 · 문구는 app-core(retireExperiment · retireExperimentView).
  import { onUploadStatus, retirementUploadStatus } from '@offside/app-core/outboxStore';
  import {
    retireNextStep,
    type RetireAccount,
    type RetireCta,
    type RetireScene,
    type RetireSceneKind,
  } from '@offside/app-core/retireExperiment';
  import { retireCtaLabel, retireNextText, retireSceneView } from '@offside/app-core/retireExperimentView';
  import { retireExpText as L } from '@offside/app-core/i18n/ko/retireExp';

  const {
    cid,
    pos,
    scenes,
    account,
    onscene,
    oncta,
  }: {
    cid: string;
    pos: string;
    scenes: RetireScene[];
    account: RetireAccount;
    onscene: (kind: RetireSceneKind) => void;
    oncta: (cta: RetireCta) => void;
  } = $props();

  const views = $derived(scenes.map((s) => retireSceneView(s, pos)));
  let open = $state<RetireSceneKind | null>(null);
  function toggle(kind: RetireSceneKind) {
    if (open !== kind) onscene(kind);
    open = open === kind ? null : kind;
  }

  // 기기 안 업로드 큐만 읽는다(서버에 묻지 않는다). 큐가 바뀌면 안내도 바뀐다.
  let tick = $state(0);
  $effect(() => onUploadStatus(() => tick++));
  const next = $derived.by(() => {
    void tick;
    return retireNextStep(account, retirementUploadStatus(cid).state);
  });
</script>

<section class="card stack retire-exp" data-retire-exp="treatment">
  {#if views.length}
    <div><div class="eyebrow">{L.eyebrow}</div><h2>{L.title}</h2></div>
    <ol class="rx-scenes" data-retire-scenes={views.length}>
      {#each views as s (s.kind)}
        <li class="rx-scene" data-scene={s.kind}>
          <button
            class="rx-head"
            data-act="retire-scene"
            aria-expanded={open === s.kind}
            onclick={() => toggle(s.kind)}
          >
            <span class="rx-title">{s.title}</span>
            <span class="rx-when">{s.when}</span>
            <span class="rx-stats">{s.rating ? `${s.stats} · ${s.rating}` : s.stats}</span>
            <span class="rx-more" aria-hidden="true">{open === s.kind ? L.close : L.open}</span>
          </button>
          {#if open === s.kind}
            <div class="rx-detail fs-sm" data-scene-detail>
              <p>{s.detail}</p>
              {#if s.honors}<p>{s.honors}</p>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <p class="muted fs-xs">{L.note}</p>
  {/if}
  <div class="rx-next" data-retire-next={next.kind}>
    <div class="eyebrow">{L.nextEyebrow}</div>
    <h3>{L.nextTitle}</h3>
    <p class="muted fs-sm">{retireNextText(next.kind)}</p>
    {#if next.cta}
      {@const cta = next.cta}
      <button class="btn btn-primary btn-block" data-act="retire-next" data-cta={cta} onclick={() => oncta(cta)}>
        {retireCtaLabel(cta)}
      </button>
    {/if}
  </div>
</section>

<style>
  .retire-exp {
    margin: 0 0 16px;
  }
  .rx-scenes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rx-scene {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    min-width: 0;
  }
  .rx-head {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-height: 44px;
  }
  .rx-title {
    font-weight: 700;
  }
  .rx-when,
  .rx-stats {
    grid-column: 1;
    overflow-wrap: anywhere;
  }
  .rx-when {
    color: var(--muted);
    font-size: var(--fs-label);
  }
  .rx-more {
    grid-column: 2;
    grid-row: 1;
    color: var(--muted);
    font-size: var(--fs-label);
  }
  .rx-detail {
    padding: 0 12px 10px;
    overflow-wrap: anywhere;
  }
  .rx-detail p {
    margin: 0;
  }
  .rx-next h3 {
    margin: 2px 0 4px;
  }
  .rx-next p {
    margin: 0 0 10px;
  }
</style>
