// 이벤트 중국어(번체) 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import type { Pos } from '../../data';
import { agentFee, fmtMoney, labelOf, weakKey } from '../../engine';
import { rivalName as rivalKo } from '../../stories';
import type { GameState, StoryState } from '../../types';
import { personName, tn } from '../names';

const byPos =
  <T>(m: Partial<Record<Pos | 'def', T>>) =>
  (s: GameState): T =>
    (m[s.pos] ?? m.def) as T;

const POS_ZH: Record<Pos, string> = {
  FW: '前鋒',
  MF: '中場',
  DF: '後衛',
  GK: '門將',
};

/** 라이벌 이름은 stories.ts rivalName이 정해 저장한다(같은 난수). 화면에서는 한자 표기로 보여 준다. */
const rivalName = (s: GameState): string => personName(rivalKo(s));
const rv = (s: GameState) => s.story.rival as StoryState & { gap: number; tone: string };

export const events_story: Record<string, EventText> = {
  'rival-1': {
    title: '同世代勁敵登場',
    text: (s) =>
      `同樣的年紀，同樣是${POS_ZH[s.pos]}。媒體開始關注你和勁敵${rivalName(s)}之間的競爭。`,
    choices: [
      {
        label: '公開下戰帖',
        ok: '標題寫著「誰比較強？很快就知道了」。戰火點燃了。',
      },
      {
        label: '不多說，用實力證明',
        ok: '你沒多說什麼。取而代之的是，訓練場最後一盞熄燈的總是你的位置。',
      },
    ],
  },
  'rival-2': {
    title: '命運的正面對決',
    text: (s) =>
      `與勁敵${rivalName(s)}對決的日子。${rv(s).tone === 'loud' ? '下戰帖後的首次交手，球場座無虛席。' : '這是兩人第一次在正式比賽中交手。'}`,
    choices: [
      {
        label: byPos<string>({
          FW: '一對一正面硬碰',
          MF: '在中場正面硬碰',
          DF: '主動請纓盯防勁敵',
          GK: '誓言在撲救大戰中勝出',
        }),
        ok: '完勝。賽後訪問，記者們只喊你的名字。',
        fail: byPos<string>({
          FW: '勁敵攻進致勝球。走回板凳的路顯得格外漫長。',
          MF: '中場爭奪完敗。勁敵的致命傳球催生了致勝球。',
          DF: '被勁敵晃過，讓他攻進致勝球。精華畫面裡映著你的背影。',
          GK: '勁敵門將零失球，你丟了兩球。比較報導滿天飛。',
        }),
      },
      {
        label: '徹底執行球隊戰術',
        ok: '個人對決打成平手。總教練高度肯定你的判斷。',
      },
    ],
  },
  'rival-3': {
    title: '國家隊的唯一名額',
    text: (s) =>
      `國家隊${POS_ZH[s.pos]}的名額只有一個。${rv(s).gap <= 0 ? '目前你領先一步。' : `目前還是勁敵${rivalName(s)}領先一步。`}`,
    choices: [
      {
        label: '競爭到最後',
        ok: '主力背心歸你了。在競爭中，你的球技也更上一層樓。',
        fail: '這次又以些微差距落敗。訓練時，眼裡只看得到自己的不足。',
      },
      {
        label: '主動伸出手',
        ok: '「多虧有你，我才能走到這裡。」兩人成了國家隊室友，一起訓練，互相吸收對方的長處。',
        fail: '伸出的手尷尬地停在半空。只留下「逃避競爭」的閒話。',
      },
    ],
  },
  'rehab-1': {
    title: '長期傷停的診斷',
    text: (s) => `精密檢查的結果出爐了。至少缺陣${s.injury}場。醫療團隊提出兩條路。`,
    choices: [
      {
        label: '接受手術',
        ok: '手術順利完成。復出會晚一點，但復發風險降低了。俱樂部對這個長遠的決定表示歡迎。',
      },
      {
        label: '選擇保守治療',
        ok: '恢復得比預期快。',
        fail: '疼痛遲遲不退。缺陣期延長了。',
      },
    ],
  },
  'rehab-2': {
    title: '復健的高牆',
    text: (s) =>
      `復健中心裡的每一天都好漫長。球隊在沒有你的情況下比賽。${s.injury ? `還要缺陣${s.injury}場。` : ''}`,
    choices: [
      {
        label: '強行提早復出',
        ok: '推翻醫療團隊的預估，回到了訓練場。',
        fail: '太心急了。同一個部位又痛了起來。',
      },
      {
        label: '完全康復再回來',
        ok: '復健期間連上半身重訓都練完了。身體比以前更結實。',
      },
    ],
  },
  'rehab-3': {
    title: '復出戰',
    text: () => '看台上呼喊你名字的聲音此起彼落。這是受傷後的第一場比賽。',
    choices: [
      {
        label: byPos<string>({
          FW: '用復出進球證明自己',
          MF: '用復出戰的進球或助攻證明自己',
          DF: '用零失球的防守證明自己',
          GK: '用零封證明自己',
        }),
        ok: '教科書般的復出舞台。地方媒體寫道：「他變得更強了。」',
        fail: byPos<string>({
          FW: '雖然沒進球，但平安無傷地踢完全場。',
          MF: '雖然沒進球，但平安無傷地踢完全場。',
          DF: '雖然沒能守住失球，但平安無傷地踢完全場。',
          GK: '雖然沒能守住失球，但平安無傷地守完全場。',
        }),
      },
      {
        label: '慢慢找回球感',
        ok: '沒有勉強自己。一點一點提高訓練強度，比賽感覺正在回來。',
      },
    ],
  },
  'scandal-2': {
    title: '醜聞餘波',
    text: () => '深夜照片的新聞在入口網站頭條掛了整整一週。俱樂部公關團隊來問你打算怎麼應對。',
    choices: [
      {
        label: '開記者會公開道歉',
        ok: '真誠的道歉讓輿論慢慢開始轉向。',
        fail: '道歉文中的一句話引發爭議，招來反彈。',
      },
      {
        label: '保持沉默',
        ok: '被其他新聞淹沒，悄悄被遺忘了。俱樂部也樂見你低調行事。',
        fail: '沉默被當成默認。俱樂部也開始和你劃清界線。',
      },
    ],
  },
  'scandal-3': {
    title: '挽回名聲的機會',
    text: () => '風波平息之際，你收到一場援助兒童癌症病童的慈善賽邀請函。',
    choices: [
      {
        label: '參加慈善賽',
        ok: '和孩子們的合照登上了新聞。',
      },
      {
        label: '只用表現回應',
        ok: '接連進球、助攻。再也沒人提起那張照片。',
        fail: '狀態持續低迷，被貼上「私生活惹的禍」的標籤。',
      },
    ],
  },
  'europe-2': {
    title: '經紀人來電',
    text: (s) => `專做歐洲轉會的大牌經紀人聯絡你。佣金是${fmtMoney(agentFee(s))}。`,
    choices: [
      {
        label: '和經紀人簽約',
        ok: '「下個轉會窗，敬請期待。」一份歐洲俱樂部名單送到了你手上。',
      },
      {
        label: '在現在的球隊繼續成長',
        ok: (s) =>
          s.contract && s.contract.years >= 3
            ? '暫時把挑戰歐洲的計畫往後延。俱樂部很歡迎你留隊的決定。'
            : '暫時把挑戰歐洲的計畫往後延。只是合約即將到期，俱樂部的反應相當冷淡。',
      },
    ],
  },
  'europe-3': {
    title: '在陌生的土地上',
    text: (s) => `在${tn(s.club.name)}的第一個賽季。語言、食物、天氣都很陌生。`,
    choices: [
      {
        label: '先學當地語言',
        ok: '三個月後，你聽得懂更衣室裡的玩笑了。',
        fail: '語言學校和訓練兩頭跑，身體累垮了。',
      },
      {
        label: '用球技溝通',
        ok: '語言雖然生疏，球技卻獲得了認可。總教練把你擺在戰術核心，主場球迷還為你編了加油歌。',
        fail: '孤獨感越來越深。每天晚上都想念家鄉的味道。',
      },
    ],
  },
  'mentor-2': {
    title: '總教練的特別課題',
    text: (s) =>
      `總教練單獨找你。「你的${labelOf(s, weakKey(s))}還不夠。只要補上這塊，你會成為更大的球員。」`,
    choices: [
      {
        label: '接受新角色',
        ok: '被說是弱點的部分，開始在比賽中派上用場。',
        fail: '像穿了不合身的衣服。但總教練還是耐心等你。',
      },
      {
        label: '堅持自己的風格',
        ok: '把長處磨得更加鋒利。總教練默默點了點頭。',
      },
    ],
  },
  'mentor-3': {
    title: '恩師轉隊',
    text: () => '一手栽培你的總教練要去執教另一支球隊。出發前一晚，電話響了。「跟我一起走。」',
    choices: [
      {
        label: '追隨恩師',
        ok: '下個轉會窗，恩師的新球隊應該會送來正式報價。',
      },
      {
        label: '留下來守護球隊',
        ok: '新總教練即將上任，俱樂部把副隊長臂章交給了留下來的你。球迷也會記得沒有離開的你。',
      },
    ],
  },
};
