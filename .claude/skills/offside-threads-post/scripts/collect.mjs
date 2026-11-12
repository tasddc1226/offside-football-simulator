// 스레드 프로필의 지난 글을 모은다. ego-browser(로그인된 세션)에서 실행한다.
// 사용: { echo "const CFG = { OUT: '<저장할 json 절대 경로>', HANDLE: 'offside.lab.kr' };"; cat collect.mjs; } | ego-browser nodejs
import fs from 'node:fs';

const task = await taskSpace('threads history');
const page = await task.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(`https://www.threads.com/@${CFG.HANDLE}`);
await sleep(6000);
const posts = new Map();
for (let i = 0; i < 60; i++) {
  const got = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/post/"]')]
      .map((a) => {
        const t = a.querySelector('time');
        if (!t) return null;
        let c = a;
        for (let k = 0; k < 9 && c.parentElement; k++) {
          c = c.parentElement;
          if (c.innerText.length > 80 && c.querySelectorAll('a[href*="/post/"] time').length === 1)
            break;
        }
        return {
          href: a.getAttribute('href'),
          time: t.getAttribute('datetime'),
          text: c.innerText,
        };
      })
      .filter(Boolean),
  );
  const before = posts.size;
  for (const g of got)
    if (!posts.has(g.href) || posts.get(g.href).text.length < g.text.length) posts.set(g.href, g);
  await page.mouse.wheel(0, 2400);
  await sleep(1400);
  if (i > 6 && posts.size === before && i % 3 === 0) {
    const end = await page.evaluate(
      () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 50,
    );
    if (end) break;
  }
}
const list = [...posts.values()].sort((a, b) => (a.time < b.time ? 1 : -1));
fs.writeFileSync(CFG.OUT, JSON.stringify(list, null, 1));
console.log('posts', list.length, list.at(-1)?.time, list[0]?.time);
await task.finish({ keep: [] });
