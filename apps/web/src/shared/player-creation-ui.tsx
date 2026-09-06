import type { Position } from '@offside/domain';
import type { ReactNode } from 'react';
import './player-creation.css';

const POSITION_SPOTS: Record<Position, { x: number; y: number }> = {
  GK: { x: 50, y: 88 },
  CB: { x: 50, y: 72 },
  FB: { x: 20, y: 66 },
  DM: { x: 50, y: 57 },
  CM: { x: 50, y: 46 },
  AM: { x: 50, y: 35 },
  W: { x: 18, y: 24 },
  ST: { x: 50, y: 14 },
};

export function CreationStage({
  number,
  eyebrow,
  title,
  description,
  children,
  labelledBy,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section className="os-creation-stage" aria-labelledby={labelledBy}>
      <header className="os-creation-stage-header">
        <span className="os-creation-stage-number" aria-hidden="true">{number}</span>
        <div>
          <p className="os-creation-kicker">{eyebrow}</p>
          <h2 id={labelledBy} tabIndex={-1}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function PositionPitch({ position, label }: { position: Position | ''; label?: string }) {
  const selected = position === '' ? undefined : POSITION_SPOTS[position];
  return (
    <div className="os-creation-pitch" aria-hidden="true">
      <span className="os-creation-pitch-line os-creation-pitch-half" />
      <span className="os-creation-pitch-circle" />
      <span className="os-creation-pitch-box os-creation-pitch-box-top" />
      <span className="os-creation-pitch-box os-creation-pitch-box-bottom" />
      {selected ? (
        <span
          key={position}
          className="os-creation-position-marker"
          style={{ left: `${selected.x}%`, top: `${selected.y}%` }}
        >
          <span>{label}</span>
        </span>
      ) : (
        <span className="os-creation-pitch-prompt">포지션을 선택하면<br />위치를 보여드려요</span>
      )}
    </div>
  );
}

export function CreationCard({
  name,
  position,
  archetype,
  team,
  foot,
  nationality,
  children,
}: {
  name: string;
  position: string;
  archetype: string;
  team: string;
  foot: string;
  nationality: string;
  children?: ReactNode;
}) {
  return (
    <article className="os-creation-player-card" aria-label={`${name} 선수 카드`}>
      <div className="os-creation-card-topline">
        <span>OFFSIDE · NEW PLAYER</span>
        <span>READY</span>
      </div>
      <div className="os-creation-card-main">
        <div className="os-creation-card-monogram" aria-hidden="true">
          {name.trim().slice(0, 1).toUpperCase()}
        </div>
        <div className="os-creation-card-identity">
          <p>{position} · {archetype}</p>
          <h2>{name}</h2>
          <span>{team}</span>
        </div>
      </div>
      <dl className="os-creation-card-facts">
        <div><dt>국적</dt><dd>{nationality}</dd></div>
        <div><dt>주발</dt><dd>{foot}</dd></div>
        <div><dt>선호 위치</dt><dd>{position}</dd></div>
      </dl>
      {children}
    </article>
  );
}
