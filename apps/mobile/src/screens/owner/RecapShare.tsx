// T-11-128 시즌 결산 SNS 공유 이미지(웹 recapShareCard.ts) — 4:5 한 장을 화면 밖에 그려 두었다가 PNG로 찍어 공유 시트로 연다.
// 같은 값(app-core seasonRecap.ts)을 쓰고 좌표는 웹 1080×1350의 절반(540×675)이다 — 캡처 때 2배로 키운다.
import { useEffect, useId, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import Svg, { Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import type { SeasonRecap } from '@offside/contracts';
import { playerName } from '@offside/app-core/format';
import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { recapTier, tierReason, tierTitle } from '@offside/app-core/ownerTier';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import {
  rankLine,
  recapHeadline,
  recapHighlights,
  recapShareCells,
} from '@offside/app-core/seasonRecap';
import { num, recordText } from '@offside/app-core/teamText';
import { TeamDialog } from '../../components/TeamDialog';
import { toast } from '../../game/host';
import { DISPLAY } from '../../theme/type';
import { Btn, Txt } from '../../ui';
import { GradeEmblem } from '../../ui/GradeEmblem';

/** 시즌 카드 · 공유 이미지가 함께 쓰는 색(테마와 상관없이 어두운 바탕 — 웹 .recap-hero · C와 같다). */
export const RECAP_INK = {
  bg: '#0b120e',
  ink: '#eef4ef',
  muted: '#9fb0a5',
  gold: '#f0b437',
  goldInk: '#231700',
  cell: 'rgba(238,244,239,0.06)',
  cellLine: 'rgba(238,244,239,0.12)',
};
const C = RECAP_INK;

/** 어두운 잔디색 바탕 + 시즌 등급 빛(가운데 위쪽에서 번진다) + 비스듬한 결. 부모를 가득 채운다. */
export function RecapBackdrop({ tier, glowY = 0.34 }: { tier: string; glowY?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const base = (EMBLEM_PALETTE[tier as keyof typeof EMBLEM_PALETTE] ?? EMBLEM_PALETTE.rookie).base;
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={`${uid}bg`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#101a14" />
          <Stop offset="1" stopColor="#0a110d" />
        </LinearGradient>
        <RadialGradient id={`${uid}glow`} cx="50%" cy={`${glowY * 100}%`} rx="62%" ry="48%">
          <Stop offset="0" stopColor={base} stopOpacity={0.5} />
          <Stop offset="0.45" stopColor={base} stopOpacity={0.16} />
          <Stop offset="1" stopColor={base} stopOpacity={0} />
        </RadialGradient>
        <Pattern
          id={`${uid}grain`}
          patternUnits="userSpaceOnUse"
          width={48}
          height={48}
          patternTransform="rotate(-55)"
        >
          <Rect width={48} height={14} fill="#ffffff" fillOpacity={0.03} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${uid}bg)`} />
      <Rect width="100%" height="100%" fill={`url(#${uid}glow)`} />
      <Rect width="100%" height="100%" fill={`url(#${uid}grain)`} />
    </Svg>
  );
}

/** 알약이 들어갈 폭을 글자 수로 어림한다(한글 · 영문 · 숫자 폭이 달라서). */
const pillWidth = (label: string, size: number) =>
  [...label].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.58), 0) +
  size * 1.7;

/** 공유 이미지(540×675). 캡처 대상이라 테마를 따르지 않고 늘 어둡다. */
function ShareCard({ recap }: { recap: SeasonRecap }) {
  const tier = recapTier(recap);
  const palette = EMBLEM_PALETTE[tier];
  const season = teamSeasonLabel(recap.season);
  const cells = recapShareCells(recap);
  const pills: string[] = [];
  let used = 0;
  for (const label of recapHighlights(recap)) {
    const w = pillWidth(label, 13) + (pills.length ? 7 : 0);
    if (used + w > 540 - 60) break;
    used += w;
    pills.push(label);
  }

  const panel = (left: number, eyebrow: string, title: string, lines: string[]) => (
    <View
      style={{
        position: 'absolute',
        left,
        top: 0,
        width: 234,
        height: 88,
        borderRadius: 9,
        backgroundColor: C.cell,
        borderWidth: 1,
        borderColor: C.cellLine,
        paddingHorizontal: 13,
        paddingTop: 9,
      }}
    >
      <Txt numberOfLines={1} style={{ color: C.muted, fontSize: 11, fontWeight: '500' }}>
        {eyebrow}
      </Txt>
      <Txt
        numberOfLines={1}
        style={{ color: C.ink, fontSize: 19, fontWeight: '700', lineHeight: 26 }}
      >
        {title}
      </Txt>
      {lines.map((line) => (
        <Txt
          key={line}
          numberOfLines={1}
          style={{ color: C.gold, fontSize: 12, fontWeight: '600', lineHeight: 16 }}
        >
          {line}
        </Txt>
      ))}
    </View>
  );

  return (
    <View style={{ width: 540, height: 675, backgroundColor: C.bg, overflow: 'hidden' }}>
      <RecapBackdrop tier={tier} glowY={0.27} />
      {/* 머리 — 게임 이름 · SEASON RECAP · 시즌 이름. */}
      <View
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Txt style={{ color: C.gold, fontSize: 20, fontFamily: DISPLAY[700], letterSpacing: 1 }}>
          OFFSIDE
        </Txt>
        <Txt style={{ color: C.muted, fontSize: 15, fontFamily: DISPLAY[700], letterSpacing: 1 }}>
          SEASON RECAP
        </Txt>
      </View>
      <Txt
        center
        numberOfLines={1}
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 56,
          color: C.ink,
          fontSize: 44,
          fontWeight: '800',
          lineHeight: 56,
        }}
      >
        {season}
      </Txt>
      {/* 시즌 등급 엠블럼(웹 230px → 115). */}
      <View style={{ position: 'absolute', left: 540 / 2 - 57.5, top: 111 }}>
        <GradeEmblem id={tier} size={115} />
      </View>
      <Txt
        center
        numberOfLines={1}
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 228,
          color: palette.light,
          fontSize: 24,
          fontWeight: '700',
          lineHeight: 32,
        }}
      >
        {tierTitle({ tier, season: recap.season })}
      </Txt>
      <Txt
        center
        numberOfLines={1}
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 262,
          color: C.muted,
          fontSize: 13,
          lineHeight: 18,
        }}
      >
        {tierReason(recap)}
      </Txt>
      <Txt
        center
        numberOfLines={2}
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 288,
          color: C.ink,
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 22,
        }}
      >
        {recapHeadline(recap)}
      </Txt>

      {/* 숫자 칸 — 세 칸씩 두 줄. */}
      {cells.map((cell, i) => (
        <View
          key={cell.key}
          style={{
            position: 'absolute',
            left: 30 + (i % 3) * (152 + 12),
            top: 328 + Math.floor(i / 3) * (64 + 12),
            width: 152,
            height: 64,
            borderRadius: 9,
            backgroundColor: C.cell,
            borderWidth: 1,
            borderColor: C.cellLine,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Txt
            num
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: cell.key === 'players' ? C.ink : C.gold,
              fontSize: 33,
              lineHeight: 36,
              maxWidth: 140,
            }}
          >
            {num(cell.value)}
          </Txt>
          <Txt numberOfLines={1} style={{ color: C.muted, fontSize: 12, fontWeight: '500' }}>
            {cell.label}
          </Txt>
        </View>
      ))}

      {/* 대표 선수 · 팀 두 칸. */}
      <View
        style={{ position: 'absolute', left: 30, top: 328 + 2 * 76 + 3, right: 30, height: 88 }}
      >
        {recap.best
          ? panel(0, L.best, playerName(recap.best.name, recap.best.pos, null), [
              L.bestScore({ score: num(recap.best.score) }),
              ...(recap.stats?.scorer
                ? [`${L.scorer} ${L.scorerGoals({ n: num(recap.stats.scorer.goals) })}`]
                : []),
            ])
          : panel(0, L.secActivity, L.players, [num(recap.players)])}
        {recap.team
          ? panel(234 + 12, L.secTeam, recap.team.name, [
              recordText({ w: recap.team.wins, d: recap.team.draws, l: recap.team.losses }),
              `${L.teamRank} ${rankLine(recap.team.rank, recap.team.ranked)}`,
            ])
          : recap.achievements
            ? panel(234 + 12, L.secAch, L.achScore, [
                num(recap.achievements.score),
                rankLine(recap.achievements.rank, recap.achievements.ranked),
              ])
            : null}
      </View>

      {/* 자랑거리 알약 — 들어가는 만큼만 한 줄로. */}
      <View
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 328 + 2 * 76 + 3 + 88 + 15,
          height: 27,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 7,
        }}
      >
        {pills.map((label) => (
          <View
            key={label}
            style={{
              height: 27,
              paddingHorizontal: 11,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: `${palette.light}88`,
              backgroundColor: `${palette.base}33`,
              justifyContent: 'center',
            }}
          >
            <Txt
              numberOfLines={1}
              style={{ color: palette.mark, fontSize: 13, fontWeight: '700', lineHeight: 18 }}
            >
              {label}
            </Txt>
          </View>
        ))}
      </View>

      {/* 바닥 — 한 줄 소개와 주소. */}
      <View
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 675 - 54,
          height: 1,
          backgroundColor: C.cellLine,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 675 - 40,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Txt
          numberOfLines={1}
          style={{ flex: 1, color: C.muted, fontSize: 12, fontWeight: '500', lineHeight: 18 }}
        >
          {L.cardTagline}
        </Txt>
        <Txt style={{ color: C.gold, fontSize: 19, fontFamily: DISPLAY[700], lineHeight: 24 }}>
          offside-lab.com
        </Txt>
      </View>
    </View>
  );
}

/** '결산 공유하기' 시트 — 열리면 이미지를 만들고, 미리보기와 함께 공유 · 다시 만들기 버튼을 보여 준다. */
export function RecapShare({ recap, close }: { recap: SeasonRecap; close: () => void }) {
  const ref = useRef<View>(null);
  const mounted = useRef(true);
  const uriRef = useRef<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const season = teamSeasonLabel(recap.season);

  useEffect(
    () => () => {
      mounted.current = false;
      if (uriRef.current) releaseCapture(uriRef.current);
    },
    [],
  );

  async function make() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const uri = await captureRef(ref, {
        format: 'png',
        result: 'tmpfile',
        width: 1080,
        height: 1350,
      });
      if (!mounted.current) {
        releaseCapture(uri);
        return;
      }
      if (uriRef.current) releaseCapture(uriRef.current);
      uriRef.current = uri;
      setShot(uri);
    } catch {
      if (mounted.current) setError(L.shareFail);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  // 그릴 준비가 되면 한 번 자동으로 만든다(웹 시트와 같다).
  const auto = useRef(false);
  useEffect(() => {
    if (ready && !auto.current) {
      auto.current = true;
      void make();
    }
    // make는 매 렌더 새로 만들어지지만 ready가 처음 켜질 때만 부르면 된다.
  }, [ready]);

  async function share() {
    if (!shot) return;
    try {
      if (!(await Sharing.isAvailableAsync())) return toast(L.shareOpenFail);
      await Sharing.shareAsync(shot, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: L.shareText({ season }),
      });
    } catch {
      toast(L.shareOpenFail);
    }
  }

  return (
    <TeamDialog title={L.shareBtn} close={close}>
      <Txt v="sm" tone="muted">
        {L.shareLead}
      </Txt>
      {shot ? (
        <Image
          source={{ uri: shot }}
          testID="recap-share-preview"
          accessibilityLabel={L.shareAlt({ season })}
          style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 12 }}
        />
      ) : busy ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {L.shareMaking}
        </Txt>
      ) : null}
      {error ? (
        <Txt tone="bad" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn
          style={{ flex: 1 }}
          testID="recap-share-make"
          disabled={busy || !ready}
          onPress={() => void make()}
        >
          {busy ? L.shareMaking : L.shareRemake}
        </Btn>
        <Btn
          style={{ flex: 1 }}
          kind="primary"
          testID="recap-share-send"
          disabled={!shot}
          onPress={() => void share()}
        >
          {L.shareNow}
        </Btn>
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -10000, top: 0 }}
      >
        <View ref={ref} collapsable={false} onLayout={() => setReady(true)}>
          <ShareCard recap={recap} />
        </View>
      </View>
    </TeamDialog>
  );
}
