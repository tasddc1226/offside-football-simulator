import type { Translation } from '@offside/contracts/i18n';
import type { gBigStageText } from '../ko/gBigStage';
import { tn } from '../names';

// 연맹별 대륙컵 이름(national.ts CONT_CUP와 같은 대회).
const CONT_CUP: Record<string, string> = {
  AFC: 'AFC亞洲盃',
  UEFA: 'UEFA歐洲盃',
  CONMEBOL: '美洲盃',
  CAF: '非洲國家盃',
  CONCACAF: 'CONCACAF金盃',
  OFC: 'OFC國家盃',
};
// 월드컵에서 간 단계(NatTour.stage 저장값) → 문장 조각.
const WC_DEEP: Record<string, string> = {
  '8강': '闖進8強', // i18n-ignore 저장값 키
  '4강': '闖進4強', // i18n-ignore 저장값 키
  준우승: '拿下亞軍', // i18n-ignore 저장값 키
  우승: '拿下冠軍', // i18n-ignore 저장값 키
};

export const gBigStage: Translation<typeof gBigStageText> = {
  wc1Title: '世界錦標賽之年',
  wc1Text: (p) =>
    `${p.year}年FIFA世界錦標賽即將舉行。國家隊總教練在訪談中表示「最終名單將依下半季的表現決定」。報導的候選名單裡也有你的名字。`,
  wc1PushLabel: '只盯著世界錦標賽，每場比賽都全力以赴',
  wc1PushOk: '上半季你一場都沒休息。看台上的國家隊教練，在筆記本上寫下了你的名字。',
  wc1PushFail: '逞強的結果是大腿後側緊繃。你躺在醫務室的病床上翻著世界錦標賽的報導。',
  wc1PaceLabel: '專注俱樂部比賽，保留體力',
  wc1PaceOk: '你一邊調整訓練量一邊打完賽季。總教練持續派上穩定的你先發。',

  wc2Title: '公布名單前一週',
  wc2Text: '距離最終名單公布只剩一週的聯賽。對方後衛從一開始就貼身猛撞。看台上坐著國家隊教練。',
  wc2FightLabel: '毫不退讓，正面硬碰',
  wc2FightOk: '你在激烈的對抗中占了上風，踢滿全場。賽後，國家隊教練走到更衣室前向你握手。',
  wc2FightFail: '搶截時腳踝扭傷。你被擔架抬走時，看台上的國家隊教練從座位上站了起來。',
  wc2SafeLabel: '不過度持球，保護好身體',
  wc2SafeOk: '你一觸球就出手，毫髮無傷地結束比賽。總教練簡短地說：「今天你在保護身體啊。」',

  wc3TitleHero: '世界錦標賽結束後',
  wc3TextHero: (p) =>
    `你在世界錦標賽上${WC_DEEP[p.stage] ?? '一路過關斬將'}後回國。機場入境大廳擠滿了記者和球迷，麥克風全都湊到你面前。`,
  wc3TextSquad:
    '你踏上世界錦標賽決賽圈的球場後回國。記者們在機場入境大廳等著你，麥克風全都湊到你面前。',
  wc3TextMissed: '世界錦標賽你是在電視上看完的。季前首次練習結束後，記者們問起你落選國家隊的事。',
  wc3TalkLabel: '坦率談談這次大賽',
  wc3TalkOk: '從大賽的幕後故事聊到下一屆世界錦標賽的目標。隔天，體育報頭版刊出了你的照片。',
  wc3TalkFail: '你對總教練戰術的一句話成了標題。國家隊相關人士打電話到俱樂部。',
  wc3BackLabel: '簡短打聲招呼，前往俱樂部訓練場',
  wc3BackOk: '「接下來我會專心俱樂部的比賽。」隔天早上，你比誰都早到訓練場。',

  paradeTitle: '奪冠遊行',
  paradeText:
    '國家隊捧著冠軍獎盃回來了。市政廳前的廣場已備好敞篷巴士遊行。俱樂部通知你，季前首次練習就在明天。',
  paradeRideLabel: '站上遊行巴士的最前面',
  paradeRideOk: '你在巴士上高舉獎盃。慶祝活動持續到天亮，隔天的練習你遲到了。',
  paradeSkipLabel: '在廣場打個招呼就回俱樂部',
  paradeSkipOk: '你向球迷揮揮手，直接前往機場。隔天早上你戴著獎牌出現在訓練場，迎來隊友們的掌聲。',

  restTitle: '大賽過後的夏天',
  restText:
    '整個夏天都在打國家隊的比賽，你終於回來了。剩下的假期只有兩週。隊友們已經開始季前訓練。',
  restFullLabel: '休完整個假期再歸隊',
  restFullOk: '你兩週沒碰球。晚了一些才歸隊的首次練習，身體輕盈地動了起來。',
  restEarlyLabel: '提前結束假期，立刻歸隊',
  restEarlyOk: '你三天就回到訓練場。總教練把你排進第一場熱身賽的先發。',
  restEarlyFail: '沒有休息夠的身體撐不住。第一場熱身賽中，你抱著小腿坐倒在地。',

  contEveTitle: '國家隊提前徵召',
  contEveText: (p) =>
    `今年夏天有${CONT_CUP[p.conf] ?? CONT_CUP.AFC!}。國家隊要求在聯賽最後一週提前徵召。俱樂部的聯賽還剩兩場。`,
  contEveGoLabel: '答應提前徵召',
  contEveGoOk: '你在聯賽最後一戰前就進了國家隊的集訓營。俱樂部總教練在記者會上沒有提到你的名字。',
  contEveStayLabel: '踢完聯賽最後一戰再歸隊',
  contEveStayOk: '你穿著俱樂部球衣打到最後一戰。晚了三天才抵達國家隊集訓營。',

  oaTitle: '超齡球員的邀約',
  oaText: (p) =>
    `${p.olympic ? '奧運' : '亞運'}代表隊總教練想以超齡名額徵召你。超齡球員最多只能選三人。這場賽事會和下個賽季的準備期重疊。`,
  oaMilText: (p) => (p.olympic ? '拿到銅牌以上還能獲得兵役豁免。' : '拿下金牌還能獲得兵役豁免。'),
  oaAcceptLabel: '說服俱樂部，接受邀約',
  oaAcceptOk: '俱樂部叮囑你「只要別受傷」，送你出發。代表隊名單的最下方，列著你的名字。',
  oaAcceptFail: '俱樂部直到最後都不肯放行，說新賽季的準備不能缺人。',
  oaDeclineLabel: '婉拒邀約，專心準備俱樂部的賽季',
  oaDeclineOk: '你說要把名額讓給年輕球員。總教練把你列為下個賽季的隊長人選。',

  galaTitle: '金球獎頒獎典禮',
  galaText: (p) =>
    p.rank === 1
      ? '金球獎頒獎典禮將在巴黎舉行。今年的得主就是你。典禮在週末聯賽的兩天前。'
      : `金球獎頒獎典禮將在巴黎舉行。你將以第${p.rank}名被點到名字。典禮在週末聯賽的兩天前。`,
  galaGoLabel: '穿上燕尾服前往巴黎',
  galaGoOk: '紅毯上，幾十台相機對準了你。過了午夜，你在返程的飛機上才終於闔上眼。',
  galaSkipLabel: '不參加典禮，準備週末的比賽',
  galaSkipOk: '你只寄去影片致詞，留在訓練場。比賽前一天，總教練拍了拍你的肩膀。',

  anthemTitle: '冠軍聯賽之夜',
  anthemText:
    '冠軍聯賽的首場比賽。走出球員通道，中圈鋪開繡著星星圖案的巨幅布幕，主題曲響徹球場。你的雙腿微微發抖。',
  anthemListenLabel: '閉上眼睛，把主題曲聽到最後',
  anthemListenOk:
    '主題曲結束時，顫抖也停了。從第一次觸球開始，球就像黏在腳上，轉播鏡頭一直追著你。',
  anthemListenFail:
    '主題曲結束了，胸口的悸動仍未平息。第一腳傳球送到了對手腳下，總教練從板凳席站了起來。',
  anthemRoutineLabel: '一如往常戴上耳機熱身',
  anthemRoutineOk: '你一如往常地熱身後上場。90分鐘沒有任何失誤。',

  awayTitle: '險惡的客場',
  awayText: (p) =>
    p.key === 'LIB'
      ? '南美自由盃的客場比賽。球場位於海拔3,600公尺的高地，跑沒幾步就喘不過氣。'
      : p.key === 'CCC'
        ? 'CONCACAF冠軍盃的客場比賽。在海拔2,200公尺的墨西哥城，8萬名觀眾從賽前就開始吹口哨。'
        : 'AFC冠軍聯賽的客場比賽。花了9小時抵達的地方，就算晚上9點開球，氣溫也有35度。',
  awayPressLabel: '開賽就強力逼搶',
  awayPressOk: '開賽20分鐘的逼搶換來了先開紀錄。客隊看台的球迷一路唱到最後。',
  awayPressFail: '30分鐘時雙腿就沉重起來。下半場連追球都做不到。',
  awayKeepLabel: '傳球控制節奏，保留體力',
  awayKeepOk: '你慢慢傳著球撐了下來。以平手帶回1分。',

  medalTitle: '亞軍獎牌',
  medalText: (p) =>
    `你們在${tn(p.comp)}決賽中落敗。領獎台下，亞軍獎牌一個個掛上。就在旁邊，對手的奪冠儀式即將開始。`,
  medalWearLabel: '戴著獎牌，為對手鼓掌',
  medalWearOk: '你戴著獎牌與對方球員握手。轉播鏡頭把這一幕拍了好久。',
  medalOffLabel: '立刻摘下獎牌握在手裡',
  medalOffOk: '你摘下獎牌握在手裡，走向更衣室。球迷轉傳這張照片，寫著「下次要拿金牌」。',
  medalOffFail: '摘下獎牌的畫面被轉播拍到了。隔天，批評你失禮的報導滿天飛。',

  deadlineTitle: '轉會市場截止日',
  deadlineText:
    '轉會市場截止日，晚上9點。經紀人打來電話。高一級聯賽的俱樂部在最後關頭提出報價，文件必須在午夜0點前送到聯賽事務局。俱樂部說沒時間找替代球員，面有難色。',
  deadlineGoLabel: '現在就去做體檢',
  deadlineGoOk: '文件在0點前3分鐘被受理。俱樂部承諾本季一結束就放你轉會。',
  deadlineGoFail: '文件在0點過後2分鐘才送到。轉會告吹，隔天訓練場的氣氛冷到了極點。',
  deadlineStayLabel: '拒絕報價，留下來',
  deadlineStayOk: '你傳訊息給經紀人，回絕了報價。隔天，總教練在練習前主動走過來向你打招呼。',

  bootTitle: '金靴爭奪戰',
  bootText: '聯賽最後一戰。與得分王只差1球。下半場尾聲，球隊獲得了點球。主罰的是隊友。',
  bootAskLabel: '拜託主罰的隊友把球讓給你',
  bootAskOk:
    '隊友把球交給了你。你騙過門將的重心，把球踢進球門左下角。射手榜的最上方寫上了你的名字。',
  bootAskFail: '隊友沒有讓球，兩人爭執的畫面被轉播拍了下來。',
  bootTeamLabel: '交給主罰的隊友',
  bootTeamOk: '隊友沉著地罰進。你第一個跑上前抱住他。',

  testiTitle: '紀念賽',
  testiText: (p) =>
    `在${tn(p.club)}的第${p.n}個賽季。俱樂部為了表彰你多年來的貢獻，決定舉辦以你命名的紀念賽。昔日的隊友一個接一個聯絡你，說要出賽。`,
  testiGiveLabel: '把門票收入捐給地方的少年足球',
  testiGiveOk: '比賽結束後，少年球員們舉著寫滿感謝的巨大布條走進球場。',
  testiKeepLabel: (p) => `收下收益（${p.fee}）`,
  testiKeepOk: '你收下了收益。和昔日的隊友們一起吃飯吃到很晚。',

  cwcTitle: 'FIFA世界俱樂部錦標賽',
  cwcText:
    '取代暑假，FIFA世界俱樂部錦標賽將在美國舉行。32支俱樂部花一個月決出世界冠軍。大賽一結束，還沒來得及休息就是新賽季。',
  cwcAllLabel: '自願參加所有比賽',
  cwcAllOk: '你在白天35度的高溫下踢滿所有比賽。每座球場都有球迷揮舞著你的球衣。',
  cwcAllFail: '在酷暑中硬撐的結果，球隊在小組賽就遭淘汰。你拖著疲憊的身體迎接新賽季。',
  cwcRestLabel: '請求輪替，保留體力',
  cwcRestOk: '小組賽的兩場比賽你在板凳席上看完。總教練什麼也沒說，換了名單。',

  flightTitle: '長途飛行後的聯賽',
  flightText: '打完兩場國際A級賽，你搭了12小時的班機回來。時差都還沒調過來，兩天後就是聯賽。',
  flightPlayLabel: '自願先發出賽',
  flightPlayOk: '你用疲憊的雙腿撐完90分鐘。賽後，總教練把你叫去道謝。',
  flightPlayFail: '下半場20分鐘大腿抽筋。你一跛一跛地被換下場。',
  flightRestLabel: '向總教練請求休息',
  flightRestOk: '你在板凳席上看完比賽。下一場比賽，你帶著清爽的身體上陣。',
};
