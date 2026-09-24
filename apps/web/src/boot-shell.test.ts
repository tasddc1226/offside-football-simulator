import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// T-10-004: index.html의 정적 홈 히어로는 JS 전 첫 페인트용 복제본이다. Home/Topbar 문구가 바뀌면
// 복제본도 같이 바꿔야 마운트 순간 화면이 튀지 않는다.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const texts = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => m[1]!.replace(/\s+/g, ' ').trim());

describe('index.html 정적 홈 히어로', () => {
  const shell = read('../index.html');
  it('Home.svelte 히어로와 같은 문구다', () => {
    const home = read('./ui/Home.svelte');
    const hero = /<section class="hero-home">([\s\S]*?)<\/section>/;
    const inner = (html: string) => texts(hero.exec(html)![1]!, />([^<>{}]+)</g).filter(Boolean);
    expect(inner(shell)).toEqual(inner(home));
  });
  it('Topbar.svelte 브랜드와 같은 문구다', () => {
    const top = read('./ui/Topbar.svelte');
    const brand = /<div class="brand">([\s\S]*?)<\/div>/;
    expect(brand.exec(shell)![1]).toBe(brand.exec(top)![1]);
  });
});
