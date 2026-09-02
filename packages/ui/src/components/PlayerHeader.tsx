import { DisplayWord } from './DisplayWord.js';

export interface PlayerHeaderField {
  label: string;
  value: string;
}

export interface PlayerHeaderProps {
  /** DisplayWord로 렌더한다(브리프 T-1-003 지정). */
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
      <DisplayWord word={name} caption={team} />
      <div className="flex flex-wrap gap-os-4">
        <Field field={position} />
        <Field field={archetype} />
        <Field field={shirtNumber} />
      </div>
    </div>
  );
}
