<script lang="ts" module>
  // 명예의 전당 1~3위 월계관. 왼쪽 가지의 잎을 원호를 따라 놓고 오른쪽은 좌우 반전해 그린다.
  // 색은 부모의 --medal(금·은·동)을 따른다. 장식이라 스크린리더에는 숨긴다(순위 숫자는 따로 읽힌다).
  const CX = 20;
  const CY = 21;
  const R = 15.5;
  const leaves = Array.from({ length: 6 }, (_, k) => {
    const deg = 118 + k * 25; // 아래(90°)에서 위쪽으로 왼편 원호를 따라 올라간다.
    const a = (deg * Math.PI) / 180;
    return [
      // 원호 바깥쪽 잎(바깥으로 벌어짐)과 안쪽 잎(안으로 기욺)을 한 쌍으로.
      { x: CX + (R + 1.6) * Math.cos(a), y: CY + (R + 1.6) * Math.sin(a), rot: deg - 30 },
      { x: CX + (R - 1.4) * Math.cos(a), y: CY + (R - 1.4) * Math.sin(a), rot: deg + 30 },
    ];
  }).flat();
  const r1 = (n: number) => Math.round(n * 10) / 10;
</script>

<svg class="laurel" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  {#each [false, true] as mirror (mirror)}
    <g transform={mirror ? `translate(${2 * CX} 0) scale(-1 1)` : undefined}>
      <path d={`M ${CX - 4} ${CY + R - 0.5} A ${R} ${R} 0 0 1 ${CX - R + 1} ${CY - 9}`} class="stem" />
      {#each leaves as l, i (i)}
        <ellipse cx={r1(l.x)} cy={r1(l.y)} rx="1.6" ry="3.8" transform={`rotate(${l.rot} ${r1(l.x)} ${r1(l.y)})`} class={i % 2 ? 'leaf in' : 'leaf'} />
      {/each}
    </g>
  {/each}
  <circle cx={CX} cy={CY + R - 0.5} r="1.6" class="knot" />
</svg>
