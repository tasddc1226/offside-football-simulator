import type { Translation } from '@offside/contracts/i18n';
import type { gMomentsText } from '../ko/gMoments';
export const gMoments: Translation<typeof gMomentsText> = {
  kidTitle: '小球迷的簽名請求',
  kidText: (p) => `賽後走向巴士的路上，一個小球迷遞出筆大喊：「${p.name}選手，請幫我簽名！」`,
  kidShirtLabel: '脫下身上的球衣送給他',
  kidShirtResult: '拿到球衣的孩子當場高興得跳起來。旁人拍下的影片隔天在社群上瘋傳。',
  kidSignLabel: '拖著疲憊的身體幫忙簽名',
  kidSignResult: '替排隊的孩子們一一簽完名才上巴士。最後一個孩子抱著簽名球朝你揮手。',

  wcTitle: '落選世界冠軍賽名單',
  wcText: '去年夏天的世界冠軍賽最終名單上沒有你的名字。新賽季前的記者會上，記者問你的感想。',
  wcQuitLabel: '批評總教練，宣布拒絕國家隊徵召',
  wcQuitResult:
    '「現任總教練底下，我不會再踢。」報導鋪天蓋地，輿論一分為二。接下來兩個賽季不接受國家隊徵召。',
  wcCalmLabel: '表達遺憾，專心準備新賽季',
  wcCalmResult: '「很可惜，但是我自己不夠好。」簡短回應後走向訓練場。國家隊教練團也看到了這番話。',

  legendTitle: '國家隊傳奇公開批評',
  legendText: '國家隊傳奇出身的球評在節目上公開批評你：「這球員名氣大，卻什麼都沒拿出來。」',
  legendReplyLabel: '在社群上反擊',
  legendReplyOk: '把最近的比賽數據截圖貼上網。留言風向倒向你這邊，球評在下一集節目收斂了不少。',
  legendReplyFail: '反擊演變成筆戰。之後只要比賽表現不好，那篇貼文就會被翻出來鞭。',
  legendIgnoreLabel: '不予理會',
  legendIgnoreResult: '一句話也沒說，照常去訓練。幾天後話題就轉移了。',

  hatTitle: '帽子戲法與MOM',
  hatText: '上演帽子戲法，獲選全場最佳球員（MOM）。記者把麥克風遞給捧著獎盃的你。',
  hatTeamLabel: '把功勞歸給隊友',
  hatTeamResult: '「三球都是隊友幫我做出來的。」更衣室裡，隊友們捧著比賽用球等著你。',
  hatFatherLabel: '把這幾球獻給父親',
  hatFatherResult:
    '「獻給小時候買給我第一顆球的爸爸。」看台上父親起身揮手的畫面被轉播鏡頭捕捉到了。',

  papTitle: '狗仔隊',
  papText: '和戀人走在街上，正好和狗仔的鏡頭對上眼。快門聲接連響起。',
  papSmileLabel: '對著鏡頭微笑',
  papSmileResult: '揮揮手走了過去。隔天照片上了新聞，「真從容」的留言佔了多數。',
  papRunLabel: '牽起戀人的手逃跑',
  papRunOk: '鑽進巷子脫身。只留下模糊的照片，新聞很快就沒人關注了。',
  papRunFail: '逃跑的背影被拍得一清二楚。「逃亡約會」標題的報導滿天飛。',

  coachTitle: '恩師辭世',
  coachText: '接到通知，青訓時期第一個發掘你的教練過世了。告別式就在比賽當天。',
  coachFuneralLabel: '缺席比賽，前往告別式',
  coachFuneralResult: '一直守在靈堂直到最後。教練的家人交給你一個相框，裡面是你首秀那天的照片。',
  coachDedicateLabel: '把這場比賽獻給教練',
  coachDedicateOk: '賽後指向天空，親吻黑色臂章。那張照片登上了隔天的頭版。',
  coachDedicateFail: '身體很沉重。下半場中段被換下，坐在板凳上不停摸著黑色臂章。',
};
