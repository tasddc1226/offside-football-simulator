// T-11-355 처음 안내 카드 · 상품 위치 안내(웹 FirstGuide.svelte·ItemsHint.svelte · 앱 screens/home/FirstGuide.tsx·components/ItemsHint.tsx).
// 길찾기 질문(포지션·유형, 스카우트권 위치, 영구결번)에 답하는 카드를 기기마다 한 번, 닫을 때까지 보여 준다.
// T-11-437 'save'는 커리어를 시작한 뒤 게임 화면에 한 번 띄우는 저장 위치 안내(웹·앱 SaveHint).
// 화면 표시만 한다 — 게임 상태·세이브·난수는 건드리지 않는다.
import { loadKey, saveKey } from '@offside/game/storage';

export type GuideCard = 'home' | 'items' | 'save';
const CARDS: readonly GuideCard[] = ['home', 'items', 'save'];

const KEY = 'ft_first_guide';

function closed(): GuideCard[] {
  const v = loadKey<unknown>(KEY);
  return Array.isArray(v) ? v.filter((x): x is GuideCard => CARDS.includes(x as GuideCard)) : [];
}

/**
 * 이 카드를 보여 줄지. 닫은 적 있으면 false. 저장소에 적을 수 없으면(사생활 보호 모드 등) 닫아도 기억하지 못해
 * 매번 다시 뜨므로 false — 지금 값을 그대로 다시 적어 보는 것으로 확인한다(본 것으로 적지는 않는다).
 */
export function guideOpen(k: GuideCard): boolean {
  const list = closed();
  return !list.includes(k) && saveKey(KEY, list);
}

/** 닫기 — 이 기기에서 다시 뜨지 않는다. */
export function closeGuide(k: GuideCard): void {
  const list = closed();
  if (!list.includes(k)) saveKey(KEY, [...list, k]);
}

/**
 * T-11-437 저장 위치 안내를 띄울지. 커리어 첫 시즌(지난 시즌 기록이 없을 때)에만, 이 기기에서 닫은 적 없을 때.
 * 이미 시즌을 넘긴 커리어에는 띄우지 않아 기존 이용자에게 갑자기 끼어들지 않는다.
 */
export const saveHintOpen = (pastSeasons: number): boolean =>
  pastSeasons === 0 && guideOpen('save');
