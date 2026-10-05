<script lang="ts">
  // T-10-026 칭호 한 개를 등급 색 알약으로 그린다. 등급은 색만이 아니라 스크린 리더용 글자로도 알린다.
  import { RARITY_LABEL, type Rarity } from '@offside/game/titles';
  import { titleTagText } from '@offside/app-core/i18n/ko/titleTag';
  import { tn } from '@offside/game/i18n/names';

  const { name, rarity, pop = false, d = 0 }: { name: string; rarity: Rarity; pop?: boolean; d?: number } = $props();
</script>

<span class="title-tag r{rarity}" class:pop style={pop ? `--d:${d}ms` : undefined}
  ><span class="sr-only">{titleTagText.tagSr({ rarity: RARITY_LABEL[rarity] })}</span>{tn(name)}</span
>
