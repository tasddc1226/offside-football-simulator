<script lang="ts">
  // T-10-076 은퇴 세리머니의 결번 유니폼(등 쪽). 3D 엔진 없이 SVG 음영(몸통 원통 음영·소매·주름·원단 결)과
  // CSS 원근 회전으로 입체감을 낸다. 색은 부모의 --rn-base/--rn-accent/--rn-ink(rnStyle).
  const { name, number }: { name: string; number: number } = $props();
  const id = $props.id();
  const SHIRT =
    'M42 7 C36 8 28 10 22 13 C15 20 9 27 4 35 L17 49 L28 41 C28.5 66 28 92 27 116 Q60 121 93 116 C92 92 91.5 66 92 41 L103 49 L116 35 C111 27 105 20 98 13 C92 10 84 8 78 7 Q60 21 42 7 Z';
</script>

<div class="rn-jersey3d">
  <svg class="rn-jersey rn-jersey-3d" viewBox="0 0 120 124" aria-hidden="true">
    <defs>
      <clipPath id="{id}-clip"><path d={SHIRT} /></clipPath>
      <!-- 몸통을 원통처럼: 양옆은 어둡고 가운데 왼쪽에 빛. -->
      <linearGradient id="{id}-body" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0.5" />
        <stop offset="0.22" stop-color="#000" stop-opacity="0.12" />
        <stop offset="0.42" stop-color="#fff" stop-opacity="0.16" />
        <stop offset="0.6" stop-color="#fff" stop-opacity="0.03" />
        <stop offset="0.82" stop-color="#000" stop-opacity="0.16" />
        <stop offset="1" stop-color="#000" stop-opacity="0.5" />
      </linearGradient>
      <linearGradient id="{id}-vert" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.14" />
        <stop offset="0.3" stop-color="#fff" stop-opacity="0" />
        <stop offset="0.82" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity="0.32" />
      </linearGradient>
      <linearGradient id="{id}-sheen" x1="0" x2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0" />
        <stop offset="0.5" stop-color="#fff" stop-opacity="0.28" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <filter id="{id}-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <!-- 원단 결: 잔 노이즈를 아주 옅게. -->
      <filter id="{id}-cloth" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
      </filter>
      <filter id="{id}-print" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="1.1" stdDeviation="0.5" flood-color="#000" flood-opacity="0.45" />
      </filter>
      <path id="{id}-arc" d="M30 43 Q60 33 90 43" />
    </defs>

    <path class="rn-shirt" d={SHIRT} />
    <g clip-path="url(#{id}-clip)">
      <!-- 소매는 몸통보다 뒤로 물러나 조금 어둡다. -->
      <path d="M22 13 C15 20 9 27 4 35 L17 49 L28 41 C27 30 25 20 22 13 Z" fill="#000" opacity="0.2" />
      <path d="M98 13 C105 20 111 27 116 35 L103 49 L92 41 C93 30 95 20 98 13 Z" fill="#000" opacity="0.26" />
      <path class="rn-cuff" d="M4 35 L17 49 L19.4 46.2 L6.4 32.2 Z" />
      <path class="rn-cuff" d="M116 35 L103 49 L100.6 46.2 L113.6 32.2 Z" />
      <rect width="120" height="124" fill="url(#{id}-body)" />
      <rect width="120" height="124" fill="url(#{id}-vert)" />
      <!-- 주름 -->
      <g filter="url(#{id}-soft)" fill="none" stroke-linecap="round">
        <path d="M37 54 Q43 80 38 114" stroke="#000" stroke-opacity="0.24" stroke-width="3" />
        <path d="M41 56 Q47 82 43 114" stroke="#fff" stroke-opacity="0.12" stroke-width="2" />
        <path d="M84 58 Q78 84 83 114" stroke="#000" stroke-opacity="0.22" stroke-width="3" />
        <path d="M29 44 Q35 50 34 62" stroke="#000" stroke-opacity="0.3" stroke-width="2.4" />
        <path d="M91 44 Q85 50 86 62" stroke="#000" stroke-opacity="0.3" stroke-width="2.4" />
        <path d="M58 100 Q62 108 60 118" stroke="#000" stroke-opacity="0.14" stroke-width="2.4" />
      </g>
      <!-- 어깨 솔기와 박음질 -->
      <g fill="none">
        <path d="M22 13 C25 20 27 30 28 41" stroke="#000" stroke-opacity="0.38" stroke-width="0.8" />
        <path d="M98 13 C95 20 93 30 92 41" stroke="#000" stroke-opacity="0.38" stroke-width="0.8" />
        <path d="M23.3 13.2 C26.2 20 28.2 30 29.2 40.5" stroke="#fff" stroke-opacity="0.3" stroke-width="0.45" stroke-dasharray="1.2 1.1" />
        <path d="M96.7 13.2 C93.8 20 91.8 30 90.8 40.5" stroke="#fff" stroke-opacity="0.3" stroke-width="0.45" stroke-dasharray="1.2 1.1" />
      </g>
      <rect width="120" height="124" filter="url(#{id}-cloth)" opacity="0.35" style="mix-blend-mode: overlay" />
      <rect class="rn-sheen" x="-60" width="60" height="124" fill="url(#{id}-sheen)" />
    </g>
    <!-- 뒷깃: 안쪽 면 + 구단 색 띠 -->
    <path d="M42 7 Q60 2 78 7 Q60 14 42 7 Z" fill="#000" opacity="0.3" />
    <path class="rn-collar" d="M42 7 Q60 14 78 7 L77.2 10.2 Q60 18 42.8 10.2 Z" />
    <path d={SHIRT} fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="0.8" stroke-linejoin="round" />

    <g filter="url(#{id}-print)">
      <text class="rn-jersey-name"><textPath href="#{id}-arc" startOffset="50%">{name}</textPath></text>
      <text class="rn-jersey-num" x="60" y="94">{number}</text>
    </g>
  </svg>
</div>
