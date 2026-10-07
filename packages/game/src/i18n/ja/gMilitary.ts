import type { Translation } from '@offside/contracts/i18n';
import type { GMilitaryMsgs } from '../ko/gMilitary';

export const gMilitary: Translation<GMilitaryMsgs> = {
  sportsNotice:
    '韓国籍の選手は大会メンバーに入り、アジア大会の金メダルか五輪の金・銀・銅メダルを取ると兵役特例を受けられます。尚武(サンム)入隊や現役入隊をせずに選手生活を続けられます。出場試合数は条件ではなく、アジアカップやワールドカップの優勝は対象外です。法的には体育要員への編入なので、基礎軍事訓練と544時間の奉仕活動を行い、34か月選手としてプレーすると服務が終わります。ゲームではシーズンが進むと自動で満たされます。尚武から切り替えた場合は、残りの服務の割合に応じて期間と奉仕時間が短くなり、修了済みの軍事教育は受け直しません。',
  sportsLegacyNotice:
    '以前の特例記録には服務期間がないため、残り期間は表示しません。特例と選手活動はそのまま続きます。',
  sportsGranted: (p) =>
    `兵役特例の対象になった。${p.medal}を獲得し、尚武入隊や現役入隊なしで選手生活を続ける。${
      p.serving
        ? '今シーズンの尚武での服務を終えたあと、体育要員に切り替える。残りの服務の割合に応じて期間と奉仕時間が短くなり、修了済みの軍事教育は受け直さない。'
        : '法的には体育要員への編入なので、基礎軍事訓練と544時間の奉仕活動を行い、34か月選手としてプレーすると服務が終わる。'
    }`,
  sportsDoneLog: '体育要員としての服務期間を終えた。基礎軍事訓練と奉仕活動もすべて終えた。',
  sportsDoneNote: '体育要員の服務完了',

  statusForeign: '対象外(外国籍)',
  statusExemptServing: (p) => `体育要員に編入予定 · シーズン終了後に尚武から切り替え(${p.exempt})`,
  statusExemptLegacy: (p) => `体育要員特例 · 以前の記録(${p.exempt})`,
  statusExemptLeft: (p) =>
    `兵役特例 · 体育要員として服務中 · 残り約${p.seasons}シーズン(${p.exempt})`,
  statusExemptDone: (p) => `兵役特例 · 体育要員の服務完了(${p.exempt})`,
  statusServing: (p) => `尚武で服務中 · 除隊まで${p.left}シーズン`,
  statusServedArmy: '現役を満期除隊',
  statusServedSangmu: '尚武を満期除隊',
  statusAccepted: '尚武に最終合格 · 入隊待ち',
  statusArmyNext: '現役入隊予定(シーズン終了後)',
  statusApplied: '尚武に志願 · シーズン終了後に発表',
  statusUnservedAmateur: '未服務',
  statusUnserved: (p) => `未服務 · 満${p.age}歳までに服務が必要`,

  sangmuName: (p) =>
    p.due ? '国軍体育部隊(尚武)に最後の志願' : '国軍体育部隊(尚武)の追加募集に志願',
  sangmuDesc: (p) =>
    `合格確率${p.pct}% · 金泉尚武で2シーズン服務しKリーグ1に出場${p.abroad ? ' · 海外クラブとの契約は解除' : ' · 除隊後は元の所属チームに復帰'}${p.due ? ' · 不合格なら現役入隊' : ' · 不合格なら今のチームに残留'}`,
  armyName: (p) => (p.due ? '現役入隊' : '現役入隊(早期)'),
  armyDesc: (p) =>
    `18か月服務 · 2シーズン公式戦に出場不可${p.abroad ? ' · 海外クラブとの契約は解除' : ''}、除隊後に元の所属チームと復帰交渉`,
  armyNote: '入営通知書が届いた。予定どおり現役で入隊する。',
  serveName: '金泉尚武に入隊',
  serveDesc: (p) =>
    `服務2シーズン · Kリーグ1に出場${p.abroad ? ` · ${p.from}との契約解除` : ` · 除隊後は${p.from}に復帰`}${p.clash ? ' · 服務中も代表に選ばれる可能性があり、メダルを取れば体育要員に切り替え' : ''}`,
  serveNote: (p) =>
    p.clash.length
      ? `国軍体育部隊の最終合格者名簿に名前が載った。服務期間中に${p.clash.join('・')}が開かれる。尚武所属でも代表に選ばれる可能性がある。`
      : '国軍体育部隊の最終合格者名簿に名前が載った。',
  hopeAg: (p) => `${p.y}アジア大会`,
  hopeOl: (p) => `${p.y}五輪`,

  enlistAbroad: (p) =>
    `国軍体育部隊に入隊。${p.club}との契約を解除して帰国し、金泉尚武のユニフォームを着る。服務期間は2シーズンだ。`,
  enlistHome: '国軍体育部隊に最終合格！金泉尚武のユニフォームを着る。服務期間は2シーズンだ。',
  armyDone: (p) =>
    `18か月の現役服務を終え、満期除隊した。体をもう一度作り直さなければならない。${p.abroad ? `${p.club}との契約は入隊時に解除されたので、新しいチームを探す必要がある。` : `${p.league}への復帰に挑む。`}`,
  sangmuAcceptedLog: '国軍体育部隊に最終合格！来シーズン、金泉尚武に入隊する。',
  sangmuRejectedLog: '国軍体育部隊に不合格。次の募集で再挑戦できる。',
  returnedLog: (p) =>
    `${p.early ? '尚武での服務を終えて体育要員に切り替え' : '金泉尚武を満期除隊'}！${p.abroad ? `契約が解除されていた${p.club}と復帰交渉に入る。` : `元の所属チームの${p.club}に戻る。`}`,

  noteCancelled: '兵役特例で尚武への志願を取り消し',
  noteAccepted: '尚武に最終合格 · 来シーズン入隊',
  noteRejected: '尚武に不合格',
  noteOneLeft: '尚武の服務が残り1シーズン',
  noteReturned: (p) =>
    `${p.early ? '体育要員に切り替え' : '尚武を満期除隊'} → ${p.club}${p.abroad ? 'と復帰交渉' : 'に復帰'}`,

  resultServeFirst: '金泉尚武に入隊した。2シーズンの間Kリーグ1の舞台でプレーしながら兵役を果たす。',
  resultServeNext: (p) => `金泉尚武での服務を続ける。除隊まで残り${p.left}シーズン。`,
  resultSangmuPass: '国軍体育部隊に最終合格！金泉尚武で2シーズンプレーしながら兵役を果たす。',
  resultSangmuFailArmy:
    '尚武に不合格…満28歳の入営期限に達し、現役で入隊した。18か月後、再びピッチに立つ。',
  resultSangmuFailNoTeam:
    '尚武に不合格。次の募集で再挑戦できる。まずはプレーするチームを決めよう。',
  resultSangmuFailStay: '尚武に不合格。今のチームでもう1シーズンプレーし、再挑戦する。',
  resultArmy: '現役で入隊した。18か月後に除隊し、復帰の準備をする。',
};
