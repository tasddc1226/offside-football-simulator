import type { Translation } from '@offside/contracts/i18n';
import type { gMomentsText } from '../ko/gMoments';
export const gMoments: Translation<typeof gMomentsText> = {
  letterTitle: '小球迷的第一場比賽',
  letterShirt:
    '一張照片從信封裡滑了出來。孩子穿著你當初送的球衣，袖子折了兩折。「星期六是我的第一場比賽。你第一次上場也會緊張嗎？」',
  letterBall:
    '信上貼著一張舊足球的照片。孩子畫了一個箭頭，指向你褪色的簽名。「我一直用這顆球練習。星期六我要第一次上場了！」',
  letterCheer: '告訴孩子我初次上場也很緊張',
  letterTip: '寫下接第一腳傳球的訣竅',
  letterCheerResult:
    '「我也很緊張。星期六我會喊著你的名字為你加油。」你把信摺好，在信封上寫下孩子的名字。',
  letterTipResult: '你在紙上畫出兩名隊友，用箭頭連起來。「球來之前先抬頭，看看隊友在哪裡。」',
  kidTitle: '小球迷的簽名請求',
  kidText: (p) => `賽後走向巴士的路上，一個小球迷遞出筆大喊：「${p.name}選手，請幫我簽名！」`,
  kidShirtLabel: '脫下身上的球衣送給他',
  kidShirtResult: '拿到球衣的孩子當場高興得跳起來。旁人拍下的影片隔天在社群上瘋傳。',
  kidSignLabel: '拖著疲憊的身體幫忙簽名',
  kidSignResult: '你替排隊的孩子一一簽名才上了巴士。隊伍最後的孩子抱著你簽名的足球，向你揮手。',

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

  backpassTitle: '再接一次回傳球',
  backpassText:
    '回到訓練場，後衛把地滾球傳向門前。上次就是這種回傳從你腳下溜了過去。教練示意前鋒上來逼搶。',
  backpassKick: '長傳給另一側的邊後衛',
  backpassKickResult: '你在前鋒逼近前抬起頭，將球送到另一側邊後衛前插的路線上。',
  backpassMove: '移到球門側邊接應',
  backpassMoveResult: '你指向門柱外側的空檔。後衛把球傳到那裡，你側身接球，球門已經不在身後了。',

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
  linkTitle: '九號球員的配合訓練',
  linkText:
    '教練把影片停在你送出助攻的那一刻。傳球後，前方留著一片空檔。教練在訓練場上標出相同的位置，問你：「接下來還能怎麼跑？」',
  linkLayoff: '背身護球，一腳回做',
  linkLayoffResult: '你用身體擋住後衛，一腳把球送到隊友腳前。球一到位，教練便拍手叫好。',
  linkRun: '回做後跑進禁區',
  linkRunResult: '球一離腳，你就繞到後衛身後，用腳內側把隊友傳回來的球推進球門死角。',
};
