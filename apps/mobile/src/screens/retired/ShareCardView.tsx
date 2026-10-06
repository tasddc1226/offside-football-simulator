// SNS 공유 이미지 카드(웹 share/shareCard.ts drawShareCard) — 같은 카드 내용(app-core shareCardData)을 1080×1350 도안
// 좌표 그대로 RN 뷰로 그린다. ShareImageCard가 이걸 화면 밖에 그려 captureRef로 PNG를 찍는다. 색·글자 크기·자리는 웹
// 캔버스 값(도안 px)을 그대로 쓴다. 글자 자리는 baseline 대신 위 끝 기준이라 웹과 몇 px 어긋날 수 있다.
import { Text, View, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CARD_H,
  CARD_W,
  cardBrand,
  tagline,
  type ShareCardData,
} from '@offside/app-core/shareCard';
import { RnFrame } from '../../components/RnFrame';
import { DISPLAY, fitLine } from '../../theme/type';

const C = {
  bg0: '#0c1c14',
  bg1: '#08120d',
  ink: '#eef4ef',
  muted: '#a9b8ae',
  gold: '#f0b437',
  onGold: '#1a1204',
  line: 'rgba(238, 244, 239, 0.16)',
  chip: 'rgba(238, 244, 239, 0.08)',
};
const PAD = 80;
const INNER = CARD_W - PAD * 2;
const MID = CARD_W / 2;
const PILL = { h: 62, padX: 28, gap: 16 };
/** 여정 한 줄: 연도는 YEAR_X에 오른쪽 맞춤, 구단·리그는 CLUB_X부터. */
const YEAR_X = MID - 190;
const CLUB_X = MID - 160;

/** 글자 한 줄: baseline y에 놓는다(줄 높이=글자 크기로 두고 위 끝을 글자 크기의 0.82만큼 올린다). */
function T({
  children,
  y,
  size,
  color,
  weight = '400',
  display,
  align = 'center',
  x = 0,
  w = CARD_W,
  gap,
  max,
}: {
  children: string;
  y: number;
  size: number;
  color: string;
  weight?: TextStyle['fontWeight'];
  display?: keyof typeof DISPLAY;
  align?: 'left' | 'center' | 'right';
  /** 상자 왼쪽 끝. */
  x?: number;
  w?: number;
  /** 자간(px) — 가운데 정렬 때 뒤에 붙는 자간만큼 왼쪽에 채워 균형을 맞춘다. */
  gap?: number;
  max?: number;
}) {
  return (
    <Text
      numberOfLines={1}
      style={fitLine({
        position: 'absolute',
        top: y - size * 0.82,
        left: x,
        width: max ?? w,
        textAlign: align,
        fontSize: size,
        lineHeight: size,
        color,
        ...(display ? { fontFamily: DISPLAY[display] } : { fontWeight: weight }),
        ...(gap ? { letterSpacing: gap, paddingLeft: align === 'center' ? gap : 0 } : {}),
      })}
    >
      {children}
    </Text>
  );
}

export function ShareCardView({ c }: { c: ShareCardData }) {
  // 커리어 여정(+ 성향이 없으면 대표 우승). 성향 칸이 없으면 기록 아래~바닥 줄 사이 가운데에 둔다(짧은 여정이 위에 몰리지 않게).
  const sy = 680;
  let y = sy + 206;
  const HONOURS_GAP = 26;
  if (!c.style) {
    const rows = c.stops.reduce((n, s) => n + (s ? 52 : 40), 0);
    const honoursH = c.honours.length ? HONOURS_GAP + 56 + c.honours.length * 52 : 0;
    const blockH = 22 + 56 + rows + honoursH - 52 + 10; // 제목 글자 윗선 ~ 마지막 줄 아랫선
    y = Math.max(y, Math.round(sy + 148 + (CARD_H - 100 - (sy + 148) - blockH) / 2 + 22));
  }
  const journeyY = y;
  y += 56;
  const stopRows: { y: number; s: ShareCardData['stops'][number] }[] = [];
  for (const s of c.stops) {
    stopRows.push({ y, s });
    y += s ? 52 : 40;
  }
  let honoursY = 0;
  const honourRows: { y: number; h: ShareCardData['honours'][number] }[] = [];
  if (c.honours.length) {
    y += HONOURS_GAP;
    honoursY = y;
    y += 56;
    for (const h of c.honours) {
      honourRows.push({ y, h });
      y += 52;
    }
  }
  const styleY = c.style ? Math.max(y + 18, 1100) : 0;
  const scoreX = c.jersey ? MID - 200 : MID;

  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: C.bg1, overflow: 'hidden' }}>
      {/* 배경: 은퇴 크레딧과 같은 밤 경기장 톤 + 위쪽 금빛 조명 + 센터 서클. */}
      <LinearGradient
        colors={[C.bg0, C.bg1, C.bg1]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H }}
      />
      <LinearGradient
        colors={['rgba(240,180,55,0.18)', 'rgba(240,180,55,0)']}
        style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: 760 }}
      />
      <View
        style={{
          position: 'absolute',
          left: MID - 240,
          top: 430 - 240,
          width: 480,
          height: 480,
          borderRadius: 240,
          borderWidth: 3,
          borderColor: 'rgba(238,244,239,0.05)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 429,
          width: CARD_W,
          height: 3,
          backgroundColor: 'rgba(238,244,239,0.05)',
        }}
      />

      {/* 머리: FULL TIME · 이름 · 포지션/기간 */}
      <T y={118} size={34} color={C.gold} display={600} gap={7}>
        {c.kicker}
      </T>
      <T y={232} size={104} color={C.ink} weight="700" x={PAD} w={INNER}>
        {c.name}
      </T>
      <T y={290} size={34} color={C.muted} x={PAD} w={INNER}>
        {c.sub}
      </T>

      {/* 레전드 점수(영구결번이면 왼쪽으로 비키고 오른쪽에 결번 유니폼) */}
      <T y={500} size={210} color={C.gold} display={700} x={scoreX - CARD_W / 2}>
        {String(c.score)}
      </T>
      <T y={546} size={30} color={C.muted} display={600} gap={8} x={scoreX - CARD_W / 2}>
        LEGEND SCORE
      </T>
      {c.jersey ? (
        <View style={{ position: 'absolute', left: MID + 215 - 99, top: 300 }}>
          <RnFrame clubId={c.jersey.clubId} number={c.jersey.number} width={198} />
        </View>
      ) : null}

      {/* 배지: 한 줄에 가운데 정렬. 넘치면 앞 글자를 줄이고 뒷부분(tail)은 남긴다. */}
      <View
        style={{
          position: 'absolute',
          top: 578,
          left: PAD,
          width: INNER,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: PILL.gap,
        }}
      >
        {c.pills.map((p, i) => (
          <View
            key={i}
            style={{
              height: PILL.h,
              borderRadius: PILL.h / 2,
              paddingHorizontal: PILL.padX,
              flexDirection: 'row',
              alignItems: 'center',
              flexShrink: 1,
              backgroundColor: p.gold ? C.gold : C.chip,
              ...(p.gold ? {} : { borderWidth: 2, borderColor: C.line }),
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 32,
                fontWeight: '600',
                color: p.gold ? C.onGold : C.ink,
              }}
            >
              {p.text}
            </Text>
            {p.tail ? (
              <Text
                numberOfLines={1}
                style={{ fontSize: 32, fontWeight: '600', color: p.gold ? C.onGold : C.ink }}
              >
                {p.tail}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* 통산 기록 */}
      <View
        style={{
          position: 'absolute',
          left: PAD,
          top: sy,
          width: INNER,
          height: 2,
          backgroundColor: C.line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: PAD,
          top: sy + 148,
          width: INNER,
          height: 2,
          backgroundColor: C.line,
        }}
      />
      {c.stats.map((s, i) => {
        const cw = INNER / c.stats.length;
        return (
          <View key={s.label}>
            <T y={sy + 88} size={76} color={C.ink} display={700} x={PAD + cw * i} w={cw}>
              {s.value}
            </T>
            <T y={sy + 128} size={28} color={C.muted} x={PAD + cw * i} w={cw}>
              {s.label}
            </T>
          </View>
        );
      })}

      {/* 커리어 여정(+ 성향이 없으면 대표 우승) */}
      <T y={journeyY} size={28} color={C.gold} display={600} gap={6}>
        THE JOURNEY
      </T>
      {stopRows.map(({ y: ry, s }, i) =>
        s ? (
          <View key={i}>
            <T
              y={ry}
              size={34}
              color={C.muted}
              display={600}
              align="right"
              x={YEAR_X - 300}
              w={300}
            >
              {s.years}
            </T>
            <View
              style={{
                position: 'absolute',
                left: CLUB_X,
                width: CARD_W - PAD - CLUB_X,
                top: ry - 34 * 0.82,
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 16,
              }}
            >
              <Text
                numberOfLines={1}
                style={fitLine({
                  maxWidth: 430,
                  fontSize: 34,
                  lineHeight: 34,
                  fontWeight: '600',
                  color: C.ink,
                })}
              >
                {s.club}
              </Text>
              <Text
                numberOfLines={1}
                style={{ flexShrink: 1, fontSize: 26, lineHeight: 34, color: C.muted }}
              >
                {s.league}
              </Text>
            </View>
          </View>
        ) : (
          <T key={i} y={ry - 6} size={30} color={C.muted} x={YEAR_X + 15 - 20} w={40}>
            ⋮
          </T>
        ),
      )}
      {c.honours.length ? (
        <>
          <T y={honoursY} size={28} color={C.gold} display={600} gap={6}>
            HONOURS
          </T>
          {honourRows.map(({ y: ry, h }) => (
            <View key={h.name}>
              <T
                y={ry}
                size={34}
                color={C.gold}
                display={600}
                align="right"
                x={YEAR_X - 300}
                w={300}
              >
                {h.count}
              </T>
              <T
                y={ry}
                size={34}
                color={C.ink}
                weight="600"
                align="left"
                x={CLUB_X}
                w={CARD_W - PAD - CLUB_X}
              >
                {h.name}
              </T>
            </View>
          ))}
        </>
      ) : null}

      {/* 플레이 성향 */}
      {c.style ? (
        <>
          <T y={styleY} size={28} color={C.gold} display={600} gap={6}>
            HOW I PLAYED
          </T>
          <T y={styleY + 70} size={52} color={C.ink} weight="700" x={PAD} w={INNER}>
            {`${c.style.icon} ${c.style.name}`}
          </T>
          <T y={styleY + 120} size={30} color={C.muted} x={PAD} w={INNER}>
            {c.style.best ?? c.style.line}
          </T>
        </>
      ) : null}

      {/* 바닥: 게임 이름과 주소 */}
      <View
        style={{
          position: 'absolute',
          left: PAD,
          top: CARD_H - 100,
          width: INNER,
          height: 2,
          backgroundColor: C.line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: PAD,
          width: INNER,
          top: CARD_H - 44 - 36 * 0.82,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 24, flexShrink: 1 }}>
          <Text style={fitLine({ fontSize: 36, lineHeight: 36, fontWeight: '700', color: C.ink })}>
            {cardBrand()}
          </Text>
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, fontSize: 26, lineHeight: 36, color: C.muted }}
          >
            {tagline()}
          </Text>
        </View>
        <Text
          style={fitLine({ fontFamily: DISPLAY[600], fontSize: 36, lineHeight: 36, color: C.gold })}
        >
          offside-lab.com
        </Text>
      </View>
    </View>
  );
}
