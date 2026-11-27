// 인스타그램 웹에서 릴스 한 편을 올려 예약(또는 바로 공유 직전까지)한다. ego-browser(로그인된 세션)에서 실행한다.
// 사용:
//   { echo "const CFG = { FILE: '<mp4 절대 경로>', CAPTION_FILE: '<caption.txt 절대 경로>', DATE: '2026-11-27', HOUR12: '06', MINUTE: '00', AMPM: 'P', HANDLE: 'offside.lab.kr', AI_LABEL: true };"; cat schedule.mjs; } | ego-browser nodejs
// - 단계마다 화면 상태를 읽고 이어서 진행하므로, 중간에 멈추면 같은 명령을 다시 실행하면 된다.
// - 예약 전에 날짜 · 시각 · AI 레이블 · Facebook 공유 끔 · 캡션 글자 수를 검사하고, 하나라도 어긋나면 누르지 않는다.
// - 끝나면 "SCHEDULED <날짜> <파일>"을 출력한다. 작업 공간은 닫지 않는다(여러 편을 이어서 걸 수 있게). 마지막에 따로 finish 한다.
import fs from 'node:fs';

const CAP = fs.readFileSync(CFG.CAPTION_FILE, 'utf8').replace(/\s+$/, '');
const SPACE = 'instagram reel schedule';
const task = await taskSpace(SPACE);
const page = (await task.pages())[0];
const sleep = (ms) => page.waitForTimeout(ms);

const dialogText = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('div[role=dialog]')].map((d) => d.innerText).join('\n---\n'),
  );
const has = async (s) => (await dialogText()).includes(s);
const waitHas = async (s, ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await has(s)) return true;
    await sleep(700);
  }
  return false;
};
// 맨 위 대화 상자에서 aria-label 또는 정확한 글자로 요소 중심 좌표를 찾는다.
const find = (q) =>
  page.evaluate((q) => {
    const root = [...document.querySelectorAll('div[role=dialog]')].pop() || document;
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const all = [...root.querySelectorAll('*')];
    const el =
      all.find((e) => vis(e) && e.getAttribute('aria-label') === q) ||
      all.filter((e) => vis(e) && e.children.length === 0 && e.textContent.trim() === q).pop();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, q);
const tap = async (q, label) => {
  const p = await find(q);
  if (!p) throw new Error('not found: ' + q);
  await page.mouse.click(p.x, p.y, { label });
};
const centerOf = (selector, closest) =>
  page.evaluate(
    ([selector, closest]) => {
      let e = document.querySelector(selector);
      if (e && closest) e = e.closest(closest) || e;
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    },
    [selector, closest],
  );
// 스위치 순서: AI 레이블, 콘텐츠 예약, Facebook 공유
const switches = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('div[role=dialog] input[role=switch]')].map((e) => {
      const r = e.getBoundingClientRect();
      let p = e;
      let t = '';
      for (let i = 0; i < 6 && p; i++) {
        p = p.parentElement;
        if (p && p.innerText && p.innerText.trim()) {
          t = p.innerText.trim().split('\n')[0];
          break;
        }
      }
      return {
        t,
        checked: e.checked,
        x: Math.round(r.x + r.width / 2),
        y: Math.round(r.y + r.height / 2),
      };
    }),
  );
const calOpen = () =>
  page.evaluate(() => {
    const root = [...document.querySelectorAll('div[role=dialog]')].pop();
    return root && /^\d{4}년 \d+월\n일\n월/.test(root.innerText)
      ? root.innerText.split('\n')[0]
      : null;
  });
const schedText = async () => {
  const t = await dialogText();
  const i = t.indexOf('날짜');
  return i < 0 ? '' : t.slice(i, t.indexOf('공유', i)).replace(/\n/g, ' ');
};

// 0. 프로필에서 시작. 앞 편의 완료 창이 남아 있으면 닫는다.
if (!(await page.url()).includes('instagram.com')) {
  await page.goto(`https://www.instagram.com/${CFG.HANDLE}/`, { timeout: 60000 });
  await sleep(4000);
}
if (/릴스가 예약되었습니다|릴스가 공유되었습니다/.test(await dialogText())) {
  await tap('완료', 'close done dialog');
  await sleep(1500);
}

// 1. 새로운 게시물 → 게시물 → 파일
if (!(await dialogText()).trim()) {
  const np = await centerOf("svg[aria-label='새로운 게시물']");
  await page.mouse.click(np.x, np.y, { label: 'open new post menu' });
  await sleep(1200);
  const pp = await centerOf("svg[aria-label='게시물']", 'a');
  await page.mouse.click(pp.x, pp.y, { label: 'choose post type' });
  await page.waitForSelector('div[role=dialog] input[type=file]', {
    state: 'attached',
    timeout: 10000,
  });
  await page.setInputFiles('div[role=dialog] input[type=file]', [CFG.FILE]);
  if (!(await waitHas('자르기'))) throw new Error('crop step not reached');
  await sleep(1500);
}

// 2. 자르기 9:16. "다음"이 한 번에 안 먹을 때가 있어 화면이 바뀔 때까지 다시 누른다.
if (await has('자르기')) {
  await tap('자르기 선택', 'open crop options');
  await sleep(800);
  await tap('9:16', 'choose 9:16 crop');
  await sleep(800);
  for (let i = 0; i < 4 && !(await has('커버 사진')); i++) {
    await tap('다음', 'next step');
    await waitHas('커버 사진', 8000);
  }
  await sleep(2000);
}

// 3. 편집 화면(길이 표시로 올린 파일이 맞는지 볼 수 있다)
if (await has('커버 사진')) {
  console.log('edit:', (await dialogText()).replace(/\n/g, ' '));
  for (let i = 0; i < 4 && !(await has('/2200')); i++) {
    await tap('다음', 'next step');
    await waitHas('/2200', 8000);
  }
  await sleep(2000);
}
if (!(await has('/2200'))) throw new Error('caption step not reached');

// 4. 캡션. 붙여넣은 뒤 원문과 같은지 비교한다.
const captionBox = 'div[role=dialog] div[contenteditable=true]';
if (!(await page.evaluate((s) => document.querySelector(s).innerText.trim(), captionBox))) {
  await page.click(`${captionBox}[aria-label='캡션 추가...']`, { label: 'focus caption box' });
  await page.keyboard.paste(CAP);
  await sleep(1200);
}
const got = await page.evaluate((s) => document.querySelector(s).innerText, captionBox);
const norm = (s) => s.replace(/\n+/g, '\n').trim();
console.log({ want: CAP.length, got: got.length });
if (norm(got) !== norm(CAP)) throw new Error('caption mismatch');

// 5. 스위치와 시각. 달력이 열려 있으면 건너뛴다(다시 실행한 경우).
if (!(await calOpen())) {
  await tap(CFG.HANDLE, 'close hashtag suggestions').catch(() => {});
  await sleep(500);
  let sw = await switches();
  if (CFG.AI_LABEL !== false && !sw[0].checked)
    await page.mouse.click(sw[0].x, sw[0].y, { label: 'turn on AI label' });
  await sleep(800);
  sw = await switches();
  const sch = sw.find((s) => s.t === '콘텐츠 예약');
  if (!sch.checked) await page.mouse.click(sch.x, sch.y, { label: 'turn on scheduling' });
  await sleep(1500);
  for (const [al, txt] of [
    ['Hours', CFG.HOUR12],
    ['Minutes', CFG.MINUTE],
    ['AM PM', CFG.AMPM],
  ]) {
    const p = await find(al);
    await page.mouse.click(p.x, p.y, { label: 'set ' + al });
    await sleep(300);
    await page.keyboard.type(txt);
    await sleep(400);
  }
}

// 6. 날짜. 다음 달은 "Next month"로 넘기고, 누를 수 있는 칸만 고른다.
const [Y, M, D] = CFG.DATE.split('-').map(Number);
const want = `${Y}년 ${M}월 ${D}일`;
if (!(await schedText()).includes(want) || (await calOpen())) {
  if (!(await calOpen())) {
    const d = await page.evaluate(() => {
      const root = [...document.querySelectorAll('div[role=dialog]')].pop();
      const e = [...root.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && /^\d{4}년 \d+월 \d+일/.test(e.textContent.trim()))
        .pop();
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    await page.mouse.click(d.x, d.y, { label: 'open date picker' });
    await sleep(1200);
  }
  for (let i = 0; i < 12 && (await calOpen()) !== `${Y}년 ${M}월`; i++) {
    await tap('Next month', 'go to next month');
    await sleep(900);
  }
  if ((await calOpen()) !== `${Y}년 ${M}월`)
    throw new Error('month not reached: ' + (await calOpen()));
  const c = await page.evaluate((D) => {
    const root = [...document.querySelectorAll('div[role=dialog]')].pop();
    const b = [...root.querySelectorAll('button[role=gridcell]')].find(
      (b) => b.getAttribute('aria-disabled') === 'false' && b.textContent.trim() === String(D),
    );
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, D);
  if (!c) throw new Error('day not selectable');
  await page.mouse.click(c.x, c.y, { label: 'pick schedule date' });
  await sleep(1200);
}

// 7. 검사 후 예약
const st = await schedText();
const sws = await switches();
console.log(sws.map((s) => `${s.t}=${s.checked}`).join(', '), '|', st);
const timeOk = st.includes(`시간 ${CFG.HOUR12} : ${CFG.MINUTE} ${CFG.AMPM}M`);
const ok =
  st.includes(want) &&
  timeOk &&
  (CFG.AI_LABEL === false || sws[0].checked) &&
  sws[1].checked &&
  !sws[2].checked &&
  (await has('/2200'));
if (!ok) throw new Error('precheck failed');
const p = await page.evaluate(() => {
  const root = [...document.querySelectorAll('div[role=dialog]')].pop();
  const e = [...root.querySelectorAll('div[role=button]')].find(
    (e) => e.textContent.trim() === '예약',
  );
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(p.x, p.y, { label: 'schedule the reel' });
let done = false;
for (let i = 0; i < 60 && !done; i++) {
  await sleep(3000);
  done = /릴스가 예약되었습니다/.test(await dialogText());
}
console.log(done ? `SCHEDULED ${CFG.DATE} ${CFG.FILE.split('/').pop()}` : 'NOT CONFIRMED');
console.log({ taskSpaceId: task.spaceId });
