export interface PlayerHeaderField {
  label: string;
  value: string;
  /** 값 아래 보조 문구(예: RULE-PLY-001 주포지션·선호 포지션 비교). */
  caption?: string;
}

export interface PlayerHeaderProps {
  /** <h2> 요소로 렌더한다. 크기는 h1 토큰(--os-fs-h1/--os-lh-h1)을 쓰고 자간 보정은 없다(DSN-CMP-001). */
  name: string;
  team: string;
  position: PlayerHeaderField;
  archetype: PlayerHeaderField;
  shirtNumber: PlayerHeaderField;
}

function Field({ field }: { field: PlayerHeaderField }) {
  return (
    <div className="flex flex-col items-end gap-os-1">
      <span
        className="font-os text-os-text-2"
        style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
      >
        {field.label}
      </span>
      <span
        className="os-num font-os font-semibold text-os-text"
        style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}
      >
        {field.value}
      </span>
      {field.caption !== undefined ? (
        <span
          className="font-os text-os-text-2"
          style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
        >
          {field.caption}
        </span>
      ) : null}
    </div>
  );
}

export function PlayerHeader({ name, team, position, archetype, shirtNumber }: PlayerHeaderProps) {
  return (
    <div className="os-panel os-player-header">
      <div className="os-player-identity">
        <div className="os-player-shirt" aria-hidden="true">
          <svg viewBox="0 0 56 60" fill="none" focusable="false">
            <path
              d="m17 4 11 4 11-4 14 12-8 10-5-4v33H16V22l-5 4-8-10L17 4Z"
              fill="currentColor"
              opacity=".12"
            />
            <path
              d="m17 4 11 4 11-4 14 12-8 10-5-4v33H16V22l-5 4-8-10L17 4Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span className="os-num" data-shirt-number={shirtNumber.value} />
        </div>
        <div className="flex flex-col gap-os-1">
          <h2
            className="font-os font-bold text-os-text"
            style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
          >
            {name}
          </h2>
          <p
            className="font-os text-os-text-2"
            style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
          >
            {team}
          </p>
        </div>
      </div>
      <div className="os-player-fields">
        <Field field={position} />
        <Field field={archetype} />
        <Field field={shirtNumber} />
      </div>
    </div>
  );
}
