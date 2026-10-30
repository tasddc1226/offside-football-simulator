// T-11-360 홈 출석 체크(웹 HomeAttendance.svelte) — 오프사이드 컵 배너 · 구단주 선물 아래의 한 줄 입구와, 하루(KST) 한 번
// 저절로 뜨는 출석 창. 로그인한 구단주는 창에서 하루 한 번 출석해 그날 칸의 보상을 받고, 로그인하지 않은 기기는 같은 도장판과
// 로그인 버튼을 본다(로그인하면 홈에서 바로 출석). 묻는 조건 · 메모는 app-core api/attendance.ts, 띄우는 날은 attendance-view.ts.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  checkInAttendance,
  fetchAttendance,
  type AttendanceCard,
} from '@offside/app-core/api/attendance';
import {
  attendanceBoard,
  attendancePopupDue,
  boardTotal,
  ITEM_MARK,
  markAttendancePopup,
  rewardText,
} from '@offside/app-core/attendance-view';
import { claimHomePopup, passHomePopup } from '@offside/app-core/homePopup';
import { attendanceText as L } from '@offside/app-core/i18n/ko/attendance';
import type { OwnerItem } from '@offside/contracts/cup';
import { toast } from '../../game/host';
import { goRerollShop } from '../../game/nav';
import { alpha, type Colors } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Row, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';
import { useOnPull } from '../../ui/refresh';
import { LoginButtons } from '../owner/LoginButtons';
import { analyticsAskPending } from '../../components/AnalyticsAsk';

// 아이템 색: 리롤권 = 기본, 강화권 = 금(r4), 스카우트권 = 파랑(r2). 칭호 등급 색이라 두 테마 모두 대비가 맞다.
const itemColor = (c: Colors, item: OwnerItem) =>
  item === 'scout' ? c.r2 : item === 'boost' ? c.r4 : c.muted;
const ITEMS = ['reroll', 'boost', 'scout'] as const;

/** auto: 앱을 연 뒤 처음 그린 홈일 때만(Home.tsx가 정한다). 로그아웃 뒤 · 다른 화면에서 돌아올 때는 띄우지 않는다. */
export function HomeAttendance({ auto = false }: { auto?: boolean }) {
  const c = useColors();
  const [card, setCard] = useState<AttendanceCard | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // T-11-440 누른 칸(그날 보상을 글로 보인다)과 방금 받은 아이템(쓰는 곳 안내 · 내 구단 버튼).
  const [picked, setPicked] = useState<number | null>(null);
  const [got, setGot] = useState<string | null>(null);
  // 응답을 못 받아 다시 누르면 같은 키로 보내 서버가 두 번 주지 않는다. 출석이 끝나면 새 키(다음 날 누름)로 바꾼다.
  const key = useRef(crypto.randomUUID());
  const reload = useCallback(async (auto = false) => {
    const next = await fetchAttendance();
    setCard(next);
    // T-11-417 이용 분석 동의 창이 떠 있으면 오늘은 저절로 띄우지 않는다(iOS는 창 두 개를 함께 띄우지 못한다).
    // T-11-423c 홈 팝업 순서의 첫째라 띄우지 않을 때도 알려야 컵 우승 · 제휴 팝업이 기다리지 않는다.
    if (
      auto &&
      next &&
      attendancePopupDue(next) &&
      !analyticsAskPending() &&
      claimHomePopup('attendance')
    ) {
      markAttendancePopup();
      setOpen(true);
    } else passHomePopup('attendance');
  }, []);
  useEffect(() => {
    void reload(auto);
    // 처음 그릴 때 한 번만 묻는다(auto는 마운트 때 값만 쓴다).
  }, [reload]);
  useOnPull(reload);
  if (!card) return null;
  const att = card.kind === 'owner' ? card.att : null;
  const board = att ? attendanceBoard(att.stamps, att.checkedIn) : attendanceBoard(0, false);
  const ITEM = { reroll: L.itemReroll, boost: L.itemBoost, scout: L.itemScout };

  const checkIn = async () => {
    if (!att || att.checkedIn || busy) return;
    setBusy(true);
    const r = await checkInAttendance(key.current);
    setBusy(false);
    if (r.ok) {
      key.current = crypto.randomUUID();
      setCard({ kind: 'owner', att: r.data.attendance });
      setGot(rewardText(r.data.granted));
      toast(L.stamped({ n: r.data.attendance.stamps, reward: rewardText(r.data.granted) }));
    } else if (r.error.reason === 'ATTENDANCE_CHECKED') {
      setCard({ kind: 'owner', att: { ...att, checkedIn: true } });
    } else if (r.error.reason === 'GOOGLE_LOGIN_REQUIRED') {
      setCard({ kind: 'guest' });
    } else {
      toast(L.fail);
    }
  };

  const entrySub = !att
    ? L.entryGuest
    : att.checkedIn
      ? `✓ ${L.entryDone}`
      : L.entryToday({ reward: board.next.text });

  return (
    <>
      <Press
        testID={`attendance-open-${card.kind}`}
        accessibilityLabel={L.entryLabel}
        onPress={() => setOpen(true)}
      >
        <Card style={{ paddingVertical: 14 }}>
          <Row style={{ alignItems: 'center', gap: 10 }}>
            <Row style={{ alignItems: 'baseline', gap: 6 }}>
              <Txt bold>{L.title}</Txt>
              {att && att.streak > 0 ? (
                <Txt v="xs" bold num tone="accent">{`🔥 ${L.streak({ n: att.streak })}`}</Txt>
              ) : null}
            </Row>
            <Txt
              v="sm"
              numberOfLines={1}
              bold={!!att?.checkedIn}
              tone={att?.checkedIn ? 'accent' : 'muted'}
              style={{ flex: 1, textAlign: 'right' }}
            >
              {entrySub}
            </Txt>
            <Txt tone="muted">›</Txt>
          </Row>
        </Card>
      </Press>
      {open ? (
        <PopSheet
          label={L.title}
          testID={`attendance-sheet-${card.kind}`}
          onClose={() => setOpen(false)}
        >
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 2 }}>
              <Txt v="eyebrow">Daily</Txt>
              <Txt v="h3" bold accessibilityRole="header">
                {L.title}
              </Txt>
            </View>
            {att && att.streak > 0 ? (
              <Txt v="sm" bold num tone="accent" testID="attendance-streak">
                {`🔥 ${L.streak({ n: att.streak })}`}
              </Txt>
            ) : null}
          </Row>
          {/* T-11-440 칸마다 아이템 모양 기호(↻ ▲ ★)와 장수를 적어 색 없이도 가른다. 칸을 누르면 그날 보상을 글로 보인다. */}
          <View
            accessibilityLabel={L.boardLabel({ filled: board.filled, total: board.total })}
            style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 }}
          >
            {board.cells.map((cell) => {
              const tint = itemColor(c, cell.item);
              const on = picked === cell.n;
              return (
                <View key={cell.n} style={{ width: `${100 / 7}%`, padding: 2 }}>
                  {/* T-11-378 동그라미 도장. 글자는 기본 글자색, 아이템은 칸 바탕 · 테두리 고리 색과 모양 기호로 보인다.
                      큰 보상 칸은 고리가 두껍고, 오늘 칸은 점선이다. */}
                  <Press
                    testID={`attendance-cell-${cell.n}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={L.cellLabel({
                      n: cell.n,
                      reward: cell.reward,
                      state: cell.on ? L.cellDone : cell.today ? L.cellToday : '',
                    })}
                    onPress={() => setPicked(on ? null : cell.n)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: RADIUS.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      backgroundColor: cell.on ? c.accent : alpha(tint, cell.big ? 0.16 : 0.08),
                      borderWidth: on ? 2 : cell.on ? 0 : cell.today || !cell.big ? 2 : 3,
                      borderStyle: cell.today && !on ? 'dashed' : 'solid',
                      borderColor: on ? c.ink : cell.today ? c.accent : tint,
                    }}
                  >
                    <Txt
                      num
                      style={{ fontSize: 10, lineHeight: 12, color: cell.on ? c.accentInk : c.ink }}
                    >
                      {String(cell.n)}
                    </Txt>
                    {/* 숫자 글꼴에는 ↻가 없어 기호는 본문 글꼴로 그린다. */}
                    <Txt v="xs" bold style={{ color: cell.on ? c.accentInk : c.ink }}>
                      {cell.on ? '✓' : ITEM_MARK[cell.item]}
                      {cell.on ? null : (
                        <Txt v="xs" bold num style={{ color: c.ink }}>
                          {String(cell.qty)}
                        </Txt>
                      )}
                    </Txt>
                  </Press>
                </View>
              );
            })}
          </View>
          <Txt
            v="sm"
            {...(picked ? {} : { tone: 'muted' as const })}
            testID="attendance-pick"
            accessibilityLiveRegion="polite"
          >
            {picked
              ? L.cellReward({ n: picked, reward: board.cells[picked - 1]!.reward })
              : L.cellHint}
          </Txt>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
          >
            {ITEMS.map((k) => (
              <Row key={k} style={{ gap: 4, alignItems: 'center' }}>
                <Txt v="xs" bold style={{ color: k === 'reroll' ? c.ink : itemColor(c, k) }}>
                  {ITEM_MARK[k]}
                </Txt>
                <Txt v="xs" tone="muted">
                  {ITEM[k]}
                </Txt>
              </Row>
            ))}
          </View>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            {att ? (
              <Txt v="sm" tone="muted" num>
                {L.board({ filled: board.filled, total: board.total })}
              </Txt>
            ) : null}
            <Txt v="sm" testID="attendance-next">
              <Txt
                v="sm"
                tone="muted"
              >{`${board.next.today ? L.todayLabel : L.tomorrowLabel} · `}</Txt>
              <Txt v="sm" bold>
                {board.next.text}
              </Txt>
            </Txt>
          </Row>
          {att?.member ? (
            <Txt v="sm" tone="good" testID="attendance-member">
              {L.memberBonus}
            </Txt>
          ) : null}
          {!att ? (
            <>
              <Txt v="sm">{L.guestLead(boardTotal())}</Txt>
              <LoginButtons back={{ home: true }} onDone={() => void reload()} />
            </>
          ) : att.checkedIn ? (
            <>
              <Txt v="sm" bold center tone="accent" testID="attendance-done">
                {L.checked}
              </Txt>
              {got ? (
                <>
                  <View
                    testID="attendance-got"
                    accessibilityLiveRegion="polite"
                    style={{
                      gap: 2,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: RADIUS.md,
                      backgroundColor: c.surface2,
                    }}
                  >
                    <Txt v="sm" bold>
                      {L.got({ reward: got })}
                    </Txt>
                    <Txt v="xs" tone="muted">
                      {L.useHint}
                    </Txt>
                  </View>
                  <Btn
                    block
                    testID="attendance-to-owner"
                    onPress={() => {
                      setOpen(false);
                      goRerollShop();
                    }}
                  >
                    {L.toOwner}
                  </Btn>
                </>
              ) : null}
            </>
          ) : (
            <Btn
              kind="accent"
              block
              disabled={busy}
              testID="attendance-check-in"
              onPress={() => void checkIn()}
            >
              {busy ? L.busy : L.btn}
            </Btn>
          )}
          {att ? (
            <Txt v="xs" tone="muted">
              {L.grace}
            </Txt>
          ) : null}
          <Btn block testID="attendance-close" onPress={() => setOpen(false)}>
            {L.close}
          </Btn>
        </PopSheet>
      ) : null}
    </>
  );
}
