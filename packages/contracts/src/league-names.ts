/**
 * T-11-640 리그 이름. 1부 1리그부터 차례로 제국 · 해와 달 · 별 · 전설의 동물 · 전설의 땅 · 보석으로 묶는다. 실제 축구 리그 이름은 쓰지 않는다. 저장하지 않고 부 · 리그 번호로
 * 찾으므로 순서를 바꾸면 이름이 바뀐다. 서버 알림(한국어로 저장)도 이 표로 옮겨서 화면과 같은 이름을 쓴다.
 */
export type LeagueTitleLang = 'ko' | 'en' | 'ja' | 'zh';

const NAMES: Record<LeagueTitleLang, string> = {
  ko: '임페리움|솔라리스|루나리스|오리온|시리우스|안드로메다|베가|피닉스|그리핀|페가수스|드라코|키메라|유니콘|크라켄|타이탄|아르카디아|아틀란티스|엘도라도|아발론|올림포스|발할라|샹그릴라|트로이|미케네|아테네|카르타고|바빌론|페르세폴리스|알렉산드리아|페트라|이타카|루비|사파이어|에메랄드|토파즈|오닉스|오팔|가넷|아메시스트|아쿠아마린|페리도트|터콰이즈|제이드|시트린|라피스|앰버|크리스털|스피넬|지르콘|문스톤|선스톤|옵시디언|펄|투르말린|알렉산드라이트|말라카이트|아게이트|재스퍼|베릴|탄자나이트|모거나이트|로도나이트|쿼츠', // i18n-ignore: 리그 이름 원본(서버 · 화면 공용)
  en: 'Imperium|Solaris|Lunaris|Orion|Sirius|Andromeda|Vega|Phoenix|Gryphon|Pegasus|Draco|Chimera|Unicorn|Kraken|Titan|Arcadia|Atlantis|El Dorado|Avalon|Olympus|Valhalla|Shangri-La|Troy|Mycenae|Athens|Carthage|Babylon|Persepolis|Alexandria|Petra|Ithaca|Ruby|Sapphire|Emerald|Topaz|Onyx|Opal|Garnet|Amethyst|Aquamarine|Peridot|Turquoise|Jade|Citrine|Lapis|Amber|Crystal|Spinel|Zircon|Moonstone|Sunstone|Obsidian|Pearl|Tourmaline|Alexandrite|Malachite|Agate|Jasper|Beryl|Tanzanite|Morganite|Rhodonite|Quartz',
  ja: 'インペリウム|ソラリス|ルナリス|オリオン|シリウス|アンドロメダ|ベガ|フェニックス|グリフォン|ペガサス|ドラコ|キマイラ|ユニコーン|クラーケン|タイタン|アルカディア|アトランティス|エルドラド|アヴァロン|オリュンポス|ヴァルハラ|シャングリラ|トロイア|ミケーネ|アテネ|カルタゴ|バビロン|ペルセポリス|アレクサンドリア|ペトラ|イタカ|ルビー|サファイア|エメラルド|トパーズ|オニキス|オパール|ガーネット|アメジスト|アクアマリン|ペリドット|ターコイズ|ジェイド|シトリン|ラピス|アンバー|クリスタル|スピネル|ジルコン|ムーンストーン|サンストーン|オブシディアン|パール|トルマリン|アレキサンドライト|マラカイト|アゲート|ジャスパー|ベリル|タンザナイト|モルガナイト|ロードナイト|クォーツ',
  zh: '帝國|日輪|月輪|獵戶|天狼|仙女|織女|鳳凰|獅鷲|天馬|天龍|奇美拉|獨角獸|海妖|泰坦|阿卡迪亞|亞特蘭提斯|黃金國|阿瓦隆|奧林帕斯|瓦爾哈拉|香格里拉|特洛伊|邁錫尼|雅典|迦太基|巴比倫|波斯波利斯|亞歷山大|佩特拉|伊薩卡|紅寶石|藍寶石|祖母綠|黃玉|縞瑪瑙|蛋白石|石榴石|紫水晶|海藍寶|橄欖石|綠松石|翡翠|黃水晶|青金石|琥珀|水晶|尖晶石|鋯石|月光石|日長石|黑曜石|珍珠|碧璽|變色石|孔雀石|瑪瑙|碧玉|綠柱石|坦桑石|摩根石|薔薇輝石|石英',
};
const SUFFIX: Record<LeagueTitleLang, string> = {
  ko: ' 리그', // i18n-ignore: 리그 이름 원본
  en: ' League',
  ja: 'リーグ',
  zh: '聯賽',
};

export const leagueTitles = (lang: LeagueTitleLang) =>
  NAMES[lang].split('|').map((n) => `${n}${SUFFIX[lang]}`);

const indexOf = (tier: number, league: number) => 2 ** (tier - 1) - 1 + league - 1;

/** 부 · 리그 번호의 이름. 이름표보다 리그가 많으면 null. */
export const leagueTitleOf = (lang: LeagueTitleLang, tier: number, league: number) =>
  leagueTitles(lang)[indexOf(tier, league)] ?? null;

/** 한국어 리그 이름을 다른 언어로. 표에 없으면 그대로 둔다. */
export function leagueTitleIn(ko: string, lang: LeagueTitleLang) {
  const at = leagueTitles('ko').indexOf(ko);
  return at < 0 ? ko : leagueTitles(lang)[at]!;
}
