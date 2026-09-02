export interface PlayerHeaderField {
  label: string;
  value: string;
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
      <span className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
        {field.label}
      </span>
      <span
        className="os-num font-os font-semibold text-os-text"
        style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}
      >
        {field.value}
      </span>
    </div>
  );
}

export function PlayerHeader({ name, team, position, archetype, shirtNumber }: PlayerHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-os-4 rounded-os-m border border-os-border bg-os-surface p-os-4">
      <div className="flex flex-col gap-os-1">
        <h2 className="font-os font-bold text-os-text" style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}>
          {name}
        </h2>
        <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          {team}
        </p>
      </div>
      <div className="flex flex-wrap gap-os-4">
        <Field field={position} />
        <Field field={archetype} />
        <Field field={shirtNumber} />
      </div>
    </div>
  );
}
