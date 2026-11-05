<script lang="ts">
  // T-11-639 강화 전체 화면 연출(앱 components/EnhanceFx.tsx). 판정이 끝난 뒤 보여 주기만 하고, 눌림을 막지 않으며 끝나면 사라진다.
  // 충전: 어두워지며 입자가 가운데로 모이고 빛이 커진다. 성공: 터지는 빛 · 회전 광선 · 충격파 · 불꽃 · 큰 단계 숫자.
  // 유지: 잿빛 연기. 하락: 붉은 번쩍임 · 깨진 조각이 떨어지고 숫자가 무너진다. 높은 단계 성공은 더 크게 터진다.
  import { ENHANCE_CHARGE_MS, enhanceFxBig, enhanceFxLabel, enhanceFxMs, enhanceParticles, enhanceResultKind } from '@offside/app-core/cardEnhance';
  import type { EnhanceResponse } from '@offside/app-core/api/cardEnhance';

  let { charging, result }: { charging: boolean; result: EnhanceResponse | null } = $props();

  const kind = $derived(result ? enhanceResultKind(result) : null);
  const big = $derived(result ? enhanceFxBig(result) : false);
  const IN = enhanceParticles(26);
  const SPARK = enhanceParticles(36);
  const SPARK_BIG = enhanceParticles(64);
  const SHARD = enhanceParticles(18);
  const PUFF = enhanceParticles(9);
</script>

{#if charging}
  <div class="fx" aria-hidden="true" data-enhance-charge style:--t="{ENHANCE_CHARGE_MS}ms">
    <span class="veil"></span>
    <span class="orb"></span>
    {#each IN as p, i (i)}<i class="in" style:--a="{p.angle}deg" style:--d={p.dist} style:--s="{p.size}px" style:--w={p.delay}></i>{/each}
  </div>
{:else if result && kind}
  {#key result}
    <div class="fx {kind}" class:big aria-hidden="true" data-enhance-burst={kind} style:--t="{enhanceFxMs(result)}ms">
      <span class="veil"></span>
      {#if kind === 'success'}
        <span class="rays"></span>
        {#if big}<span class="rays two"></span>{/if}
        <span class="ring"></span><span class="ring r2"></span><span class="ring r3"></span>
        {#each big ? SPARK_BIG : SPARK as p, i (i)}<i class="spark" style:--a="{p.angle}deg" style:--d={p.dist} style:--s="{p.size + 2}px" style:--w={p.delay}></i>{/each}
      {:else if kind === 'down'}
        {#each SHARD as p, i (i)}<i class="shard" style:--a="{p.angle}deg" style:--d={p.dist} style:--s="{p.size * 3}px" style:--w={p.delay}></i>{/each}
      {:else}
        {#each PUFF as p, i (i)}<i class="puff" style:--a="{p.angle}deg" style:--d={p.dist} style:--s="{p.size * 7}px" style:--w={p.delay}></i>{/each}
      {/if}
      <span class="flash"></span>
      <span class="center"><b class="num">+{result.to}</b><span class="label">{enhanceFxLabel(result)}</span></span>
    </div>
  {/key}
{/if}

<style>
  .fx{position:fixed;inset:0;z-index:5;display:grid;place-items:center;overflow:hidden;pointer-events:none;animation:fx-out var(--t) linear forwards;}
  .fx>*{grid-area:1/1;}
  [data-enhance-charge]{animation:none;}
  i{position:relative;display:block;}
  .veil{position:absolute;inset:0;background:radial-gradient(circle,#0000 0,#000a 45%,#000d 100%);animation:fx-fade 300ms ease-out both;}
  .orb{width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,#fff 0,#ffe28a 28%,#ff9d0066 58%,#0000 72%);animation:fx-orb var(--t) cubic-bezier(.5,0,.9,.5) forwards;}
  .in{width:var(--s);height:var(--s);border-radius:50%;background:#ffe28a;box-shadow:0 0 10px 2px #ffc23c;opacity:0;animation:fx-in calc(var(--t) * .55) ease-in both;animation-delay:calc(var(--t) * .45 * var(--w));}
  .rays{position:absolute;left:50%;top:50%;margin:-120vmax 0 0 -120vmax;width:240vmax;height:240vmax;border-radius:50%;background:repeating-conic-gradient(#ffd35cd0 0 7deg,#0000 7deg 24deg);-webkit-mask:radial-gradient(circle,#000 0,#000 8%,#0000 46%);mask:radial-gradient(circle,#000 0,#000 8%,#0000 46%);animation:fx-rays var(--t) ease-out both;}
  .rays.two{background:repeating-conic-gradient(#ffffffb0 0 3deg,#0000 3deg 31deg);animation-direction:reverse;}
  .ring{width:80px;height:80px;border-radius:50%;border:6px solid #ffe28a;box-shadow:0 0 22px #ffc23c,inset 0 0 22px #ffc23c;opacity:0;animation:fx-ring 720ms cubic-bezier(.1,.7,.3,1) both;}
  .r2{animation-delay:110ms;border-color:#fff;}
  .r3{animation-delay:230ms;}
  .big .ring{border-width:10px;animation-duration:1000ms;}
  .spark{width:var(--s);height:var(--s);border-radius:50%;background:#fff3c0;box-shadow:0 0 12px 3px #ffb800;opacity:0;animation:fx-spark 860ms cubic-bezier(.1,.8,.3,1) both;animation-delay:calc(70ms * var(--w));}
  .big .spark{animation-duration:1300ms;}
  .flash{position:absolute;inset:0;background:#fff4c4;opacity:0;animation:fx-flash 460ms ease-out;}
  .center{display:flex;flex-direction:column;align-items:center;gap:6px;z-index:1;}
  .num{font-family:var(--display);font-size:clamp(6rem,30vmin,10rem);font-weight:800;line-height:1;color:#ffd35c;-webkit-text-stroke:2px #7a4a00;text-shadow:0 0 18px #ffb800,0 0 54px #ff8a00;animation:fx-slam 520ms cubic-bezier(.2,1.4,.4,1) both;}
  .big .num{font-size:clamp(7rem,38vmin,13rem);color:#fff6cf;text-shadow:0 0 22px #fff,0 0 60px #ffb800,0 0 110px #ff5a00;}
  .label{font-family:var(--display);font-size:clamp(1.5rem,7vmin,2.6rem);font-weight:800;letter-spacing:.06em;color:#fff;text-shadow:0 2px 0 #0009,0 0 16px #ffb800;animation:fx-label 420ms 140ms cubic-bezier(.2,1.5,.4,1) both;}
  .down .flash{background:#ff1e2d;animation-duration:620ms;}
  .down .veil{background:radial-gradient(circle,#3a000066 0,#7a0010c0 60%,#2a0005f2 100%);}
  .down .num{color:#ff5a5f;-webkit-text-stroke-color:#4a0006;text-shadow:0 0 18px #ff1e2d,0 0 50px #a00010;animation:fx-fall calc(var(--t) * .95) cubic-bezier(.3,0,.8,.6) both;}
  .down .label{color:#ffd9da;text-shadow:0 2px 0 #0009,0 0 16px #ff1e2d;}
  .shard{width:var(--s);height:calc(var(--s) * 1.6);background:linear-gradient(135deg,#ffb3b5,#c4001a);clip-path:polygon(50% 0,100% 62%,28% 100%,0 38%);opacity:0;animation:fx-shard calc(var(--t) * .95) cubic-bezier(.3,.1,.7,.4) both;animation-delay:calc(90ms * var(--w));}
  .keep .flash{background:#c7d0ca;animation-duration:280ms;}
  .keep .veil{background:radial-gradient(circle,#0003 0,#000b 100%);}
  .keep .num{color:#d9e2dc;-webkit-text-stroke-color:#39443d;text-shadow:0 0 16px #0009;animation:fx-wobble 520ms ease-out both;}
  .keep .label{color:#d9e2dc;text-shadow:0 2px 0 #0009;}
  .puff{width:var(--s);height:var(--s);border-radius:50%;background:#aab4adaa;filter:blur(10px);opacity:0;animation:fx-puff var(--t) ease-out both;animation-delay:calc(80ms * var(--w));}
  @keyframes fx-out{0%,78%{opacity:1;}100%{opacity:0;}}
  @keyframes fx-fade{from{opacity:0;}to{opacity:1;}}
  @keyframes fx-orb{from{transform:scale(.15);opacity:.5;}to{transform:scale(3.2);opacity:1;}}
  @keyframes fx-in{0%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -62vmin));}25%{opacity:1;}100%{opacity:1;transform:rotate(var(--a)) translateY(0) scale(.3);}}
  @keyframes fx-rays{0%{opacity:0;transform:rotate(0) scale(.35);}16%{opacity:1;}70%{opacity:.8;}100%{opacity:0;transform:rotate(48deg) scale(1);}}
  @keyframes fx-ring{0%{opacity:1;transform:scale(.2);}100%{opacity:0;transform:scale(9);}}
  @keyframes fx-spark{0%{opacity:1;transform:rotate(var(--a)) translateY(0) scale(1.3);}70%{opacity:1;}100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -72vmin)) scale(.4);}}
  @keyframes fx-flash{0%{opacity:1;}100%{opacity:0;}}
  @keyframes fx-slam{0%{opacity:0;transform:scale(3.4);}55%{opacity:1;transform:scale(.88);}100%{transform:scale(1);}}
  @keyframes fx-label{0%{opacity:0;transform:translateY(16px) scale(.6);}100%{opacity:1;transform:none;}}
  @keyframes fx-fall{0%{opacity:0;transform:translateY(-70px) scale(1.5);}16%{opacity:1;transform:none;}45%{transform:rotate(-5deg);}100%{transform:translateY(46px) rotate(-11deg);}}
  @keyframes fx-shard{0%{opacity:1;transform:rotate(var(--a)) translateY(calc(var(--d) * -14vmin));}100%{opacity:0;transform:translateY(62vh) rotate(calc(var(--a) + 260deg));}}
  @keyframes fx-wobble{0%{opacity:0;transform:scale(1.3);}35%{opacity:1;transform:translateX(-10px) rotate(-3deg);}65%{transform:translateX(8px) rotate(2deg);}100%{transform:none;}}
  @keyframes fx-puff{0%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -8vmin)) scale(.5);}30%{opacity:1;}100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -34vmin)) scale(1.7);}}
</style>
