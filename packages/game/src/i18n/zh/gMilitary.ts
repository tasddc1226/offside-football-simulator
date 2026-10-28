import type { Translation } from '@offside/contracts/i18n';
import type { GMilitaryMsgs } from '../ko/gMilitary';

export const gMilitary: Translation<GMilitaryMsgs> = {
  sportsNotice:
    '韓國籍球員只要列入大賽名單，並拿到亞運金牌或奧運金、銀、銅牌，就能獲得兵役特例，不必加入尚武或現役入伍即可繼續球員生涯。出賽場數不是條件，亞洲盃、世界冠軍賽奪冠也不在適用範圍內。法律上屬於編入體育要員，須完成基礎軍事訓練與544小時志工服務，並以球員身分出賽34個月後即完成服役。遊戲中隨賽季推進會自動達成。若從尚武轉換，期間與服務時數會依剩餘服役比例縮短，已完成的軍事教育不必重新接受。',
  sportsLegacyNotice: '舊的特例紀錄沒有服役期間，因此不顯示剩餘期間。特例與球員活動照常維持。',
  sportsGranted: (p) =>
    `成為兵役特例對象。拿下${p.medal}，不必加入尚武或現役入伍即可繼續球員生涯。${
      p.serving
        ? '本賽季在尚武服役結束後轉為體育要員。期間與服務時數會依剩餘服役比例縮短，已完成的軍事教育不必重新接受。'
        : '法律上屬於編入體育要員，須完成基礎軍事訓練與544小時志工服務，並以球員身分出賽34個月後即完成服役。'
    }`,
  sportsDoneLog: '完成體育要員的服役期間。基礎軍事訓練與志工服務也全部完成。',
  sportsDoneNote: '體育要員服役完成',

  statusForeign: '不適用（外國籍）',
  statusExemptServing: (p) => `預定編入體育要員 · 賽季結束後由尚武轉換（${p.exempt}）`,
  statusExemptLegacy: (p) => `體育要員特例 · 舊紀錄（${p.exempt}）`,
  statusExemptLeft: (p) => `兵役特例 · 體育要員服役中 · 約剩${p.seasons}個賽季（${p.exempt}）`,
  statusExemptDone: (p) => `兵役特例 · 體育要員服役完成（${p.exempt}）`,
  statusServing: (p) => `尚武服役中 · 距離退伍${p.left}個賽季`,
  statusServedArmy: '現役期滿退伍',
  statusServedSangmu: '尚武期滿退伍',
  statusAccepted: '尚武最終錄取 · 等待入伍',
  statusArmyNext: '預定現役入伍（賽季結束後）',
  statusApplied: '已報考尚武 · 賽季結束後公布',
  statusUnservedAmateur: '未服役',
  statusUnserved: (p) => `未服役 · 須在滿${p.age}歲前服役`,

  sangmuName: (p) =>
    p.due ? '最後一次報考國軍體育部隊（尚武）' : '報考國軍體育部隊（尚武）追加招募',
  sangmuDesc: (p) =>
    `錄取機率${p.pct}% · 在金泉尚武服役2個賽季並出戰K1聯賽${p.abroad ? ' · 與海外俱樂部解約' : ' · 退伍後回歸原球隊'}${p.due ? ' · 未錄取則現役入伍' : ' · 未錄取則留在現在的球隊'}`,
  armyName: (p) => (p.due ? '現役入伍' : '現役入伍（提早履行）'),
  armyDesc: (p) =>
    `服役18個月 · 2個賽季無法出賽正式比賽${p.abroad ? ' · 與海外俱樂部解約' : ''}，退伍後與原球隊協商回歸`,
  armyNote: '收到入伍通知書。依約以現役身分入伍。',
  serveName: '加入金泉尚武',
  serveDesc: (p) =>
    `服役2個賽季 · 出戰K1聯賽${p.abroad ? ` · 與${p.from}解約` : ` · 退伍後回歸${p.from}`}${p.clash ? ' · 服役期間也可能入選國家隊，拿到獎牌即轉為體育要員' : ''}`,
  serveNote: (p) =>
    p.clash.length
      ? `名字出現在國軍體育部隊最終錄取名單上。服役期間將舉行${p.clash.join('、')}。即使隸屬尚武也可能入選國家隊。`
      : '名字出現在國軍體育部隊最終錄取名單上。',
  hopeAg: (p) => `${p.y}亞運`,
  hopeOl: (p) => `${p.y}奧運`,

  enlistAbroad: (p) =>
    `加入國軍體育部隊。與${p.club}解約返國，換上金泉尚武的球衣。服役期間為2個賽季。`,
  enlistHome: '國軍體育部隊最終錄取！換上金泉尚武的球衣。服役期間為2個賽季。',
  armyDone: (p) =>
    `完成18個月的現役服役，期滿退伍。得重新把身體練回來。${p.abroad ? `與${p.club}的合約已在入伍時解除，需要尋找新球隊。` : `挑戰重返${p.league}。`}`,
  sangmuAcceptedLog: '國軍體育部隊最終錄取！下賽季加入金泉尚武。',
  sangmuRejectedLog: '國軍體育部隊未錄取。下次招募可以再挑戰。',
  returnedLog: (p) =>
    `${p.early ? '結束尚武服役，轉為體育要員' : '從金泉尚武期滿退伍'}！${p.abroad ? `與先前解約的${p.club}展開回歸協商。` : `回到原球隊${p.club}。`}`,

  noteCancelled: '因兵役特例取消報考尚武',
  noteAccepted: '尚武最終錄取 · 下賽季入伍',
  noteRejected: '尚武未錄取',
  noteOneLeft: '尚武服役剩1個賽季',
  noteReturned: (p) =>
    `${p.early ? '轉為體育要員' : '尚武期滿退伍'} → ${p.abroad ? `與${p.club}協商回歸` : `回歸${p.club}`}`,

  resultServeFirst: '加入金泉尚武。接下來2個賽季在K1聯賽的舞台上出賽，同時履行兵役。',
  resultServeNext: (p) => `繼續在金泉尚武服役。距離退伍還有${p.left}個賽季。`,
  resultSangmuPass: '國軍體育部隊最終錄取！在金泉尚武出賽2個賽季，同時履行兵役。',
  resultSangmuFailArmy: '尚武未錄取…已達滿28歲的入伍期限，以現役身分入伍。18個月後將重回綠茵場。',
  resultSangmuFailNoTeam: '尚武未錄取。下次招募可以再挑戰。先決定要在哪支球隊踢球吧。',
  resultSangmuFailStay: '尚武未錄取。在現在的球隊再踢一季，然後再挑戰。',
  resultArmy: '以現役身分入伍。18個月後退伍，準備復出。',
};
