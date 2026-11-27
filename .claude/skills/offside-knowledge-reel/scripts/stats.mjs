// 프로필의 최근 릴스별 재생 · 좋아요 · 댓글 · 공유 수를 모은다. ego-browser(로그인된 세션)에서 실행한다.
// 사용: { echo "const CFG = { HANDLE: 'offside.lab.kr', LIMIT: 12 };"; cat stats.mjs; } | ego-browser nodejs
// 댓글 본문은 이 경로로 못 읽는다(목록 API가 막혀 있다). 릴스 주소를 열어 화면 글자로 읽는다.
const task = await taskSpace('instagram reel stats');
const page = (await task.pages())[0];
await page.goto(`https://www.instagram.com/${CFG.HANDLE}/reels/`, { timeout: 60000 });
await page.waitForTimeout(5000);
const codes = await page.evaluate(
  (limit) =>
    [
      ...new Set(
        [...document.querySelectorAll("a[href*='/reel/']")].map(
          (a) => a.getAttribute('href').match(/\/reel\/([^/]+)/)[1],
        ),
      ),
    ].slice(0, limit),
  CFG.LIMIT ?? 12,
);
const rows = await page.evaluate(async (codes) => {
  // 주소의 짧은 코드를 숫자 id로 바꾼다(64진수).
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const out = [];
  for (const code of codes) {
    let pk = 0n;
    for (const ch of code) pk = pk * 64n + BigInt(A.indexOf(ch));
    try {
      const r = await fetch(`/api/v1/media/${pk}/info/`, {
        headers: { 'x-ig-app-id': '936619743392459' },
        credentials: 'include',
      });
      const m = (await r.json()).items?.[0];
      out.push(
        m
          ? {
              code,
              takenAt: new Date(m.taken_at * 1000).toISOString(),
              plays: m.play_count ?? m.ig_play_count,
              likes: m.like_count,
              comments: m.comment_count,
              shares: m.reshare_count,
              firstLine: (m.caption?.text || '').split('\n')[0].slice(0, 40),
            }
          : { code, error: r.status },
      );
    } catch (e) {
      out.push({ code, error: String(e).slice(0, 60) });
    }
  }
  return out;
}, codes);
for (const r of rows) console.log(JSON.stringify(r));
await task.finish({ keep: [] });
