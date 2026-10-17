<script lang="ts">
  // T-10-092 팀의 공격·중원·수비·골문 힘(내 팀 편성 · 팀 프로필).
  import type { TeamLines } from '@offside/app-core/api/team';
  import type { SynergyLines } from '@offside/contracts/owner-team';
  import { coachLineTag } from '@offside/app-core/managerCard';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { managerText as MG } from '@offside/app-core/i18n/ko/manager';

  // T-11-323 coach를 주면 경기 계산처럼 감독 보정을 더한 값을 보이고, 칸 아래에 감독 몫(+1.0)을 붙인다.
  let { lines, coach = null, compact = false }: { lines: TeamLines; coach?: SynergyLines | null; compact?: boolean } = $props();

  const cells = () =>
    [
      ['atk', L.lineAtk],
      ['mid', L.lineMid],
      ['def', L.lineDef],
      ['gk', L.lineGk],
    ] as const;
</script>

<dl class="team-lines" class:compact data-team-lines>
  {#each cells() as [k, label] (k)}
    {@const tag = coach ? coachLineTag(coach[k]) : null}
    <div><dt>{label}</dt><dd>{Math.round(lines[k] + (coach?.[k] ?? 0))}</dd>{#if tag}<dd class="coach" class:neg={coach![k] < 0} data-coach-line={k}>{MG.teamCoachLine({ v: tag })}</dd>{/if}</div>
  {/each}
</dl>

<style>
  .team-lines {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 0;
  }
  .team-lines div {
    display: grid;
    place-items: center;
    padding: 6px 0;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .team-lines dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .team-lines dd {
    margin: 0;
    font-family: var(--display);
    font-size: 1.25rem;
    font-weight: 700;
  }
  .team-lines dd.coach {
    font-family: inherit;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--good, var(--accent));
  }
  .team-lines dd.coach.neg {
    color: var(--bad, var(--muted));
  }
  .team-lines.compact {gap:0;}
  .team-lines.compact div {display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:2px 6px;padding:10px 0;background:none;border-radius:0;border-right:1px solid var(--line);}
  .team-lines.compact div:last-child {border-right:0;}
  .team-lines.compact dt {font-size:12px;}
  .team-lines.compact dd {font-size:20px;line-height:1;}
  .team-lines.compact dd.coach {flex-basis:100%;text-align:center;font-family:inherit;font-size:11px;line-height:1.3;}
</style>
