// UX-011 생성·계약 완료 트레이딩 카드 연출. SCR-004(선수 등록 확인)·SCR-010(첫 계약 완료)가
// 공유하는 "선수 카드" 시각 언어: 구단이 정해졌으면 팀 컬러 그라데이션 + TeamBadge 큰 워터마크,
// 아직 정해지지 않았으면(예: SCR-004는 계약 전이라 team을 넘기지 않는다) 브랜드 중립(--os-hero)
// 그라데이션을 쓴다. 카드 위 텍스트는 항상 currentColor로 그려 두 배경 모두에서 각각
// --os-on-hero·--os-on-accent를 그대로 물려받는다(둘 다 tokens.css·check-contrast.mjs가 검증한
// 값이라 이 컴포넌트가 별도로 대비를 계산할 필요가 없다). 유일한 예외는 등번호 배지
// (.os-player-card-number): 자기 배경을 불투명 --os-hero로 고정하고 --os-on-hero 글자를 쓴다
// (이슈 180, player-card.css 주석 참고).
import type { CSSProperties, ReactNode } from 'react';
import { TeamBadge } from '@offside/ui';
import { getTeamIdentity } from './team-identity.js';
import './player-card.css';

export interface PlayerCardRow {
  label: string;
  value: ReactNode;
  /** 숫자·버전처럼 자릿수를 맞춰 보여줄 값이면 true — <dd>에 os-num(tabular-nums)을 붙인다. */
  numeric?: boolean;
}

export interface PlayerCardTeam {
  id: string;
  name: string;
}

export interface PlayerCardProps {
  /** 카드 좌상단 짧은 라벨(예: "PLAYER PROFILE", "WELCOME TO"). */
  eyebrow: string;
  /** 선수 이름. <h2>로 렌더한다. */
  name: string;
  /** 이름 위 보조 캡션(예: "포지션 · 스타일"). */
  subtitle?: ReactNode;
  /** 구단이 확정됐을 때만 넘긴다 — 팀 컬러 그라데이션 + TeamBadge 워터마크로 전환한다. */
  team?: PlayerCardTeam;
  /** 있으면 우상단에 등번호 배지로 보여준다. */
  shirtNumber?: number;
  rows: PlayerCardRow[];
  className?: string;
}

/**
 * SLB류 트레이딩 카드 연출을 내는 공용 선수 카드. team이 없으면 브랜드 중립 그라데이션 위에
 * 이름 이니셜 워터마크를, 있으면 팀 컬러 그라데이션 위에 TeamBadge 워터마크를 깐다. 워터마크는
 * 순전히 장식이라 aria-hidden으로 감춘다 — 카드 자체의 접근 가능한 이름은 `${name} 선수 카드`.
 */
export function PlayerCard({
  eyebrow,
  name,
  subtitle,
  team,
  shirtNumber,
  rows,
  className,
}: PlayerCardProps) {
  const identity = team === undefined ? undefined : getTeamIdentity(team.id);
  const classes = ['os-player-card', className].filter(Boolean).join(' ');
  const style =
    identity === undefined
      ? undefined
      : ({ '--os-player-card-accent': identity.colorVar } as CSSProperties);

  return (
    <article
      className={classes}
      data-team={identity === undefined ? undefined : 'true'}
      style={style}
      aria-label={`${name} 선수 카드`}
    >
      {identity !== undefined ? (
        <span className="os-player-card-watermark" aria-hidden="true">
          <TeamBadge initials={identity.initials} colorVar={identity.colorVar} size="m" />
        </span>
      ) : (
        <span className="os-player-card-monogram" aria-hidden="true">
          {name.trim().slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="os-player-card-top">
        <span className="os-player-card-eyebrow">{eyebrow}</span>
        {shirtNumber !== undefined ? (
          <span className="os-player-card-number os-num" aria-label={`등번호 ${shirtNumber}`}>
            #{shirtNumber}
          </span>
        ) : null}
      </div>

      {team !== undefined ? <p className="os-player-card-team">{team.name}</p> : null}

      <div className="os-player-card-identity">
        {subtitle !== undefined ? <p className="os-player-card-subtitle">{subtitle}</p> : null}
        <h2>{name}</h2>
      </div>

      <dl className="os-player-card-rows">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.numeric === true ? 'os-num' : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
