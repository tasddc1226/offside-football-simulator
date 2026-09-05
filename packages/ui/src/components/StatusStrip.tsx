export interface StatusStripItem {
  id: string;
  label: string;
  value: string | number;
}

export interface StatusStripProps {
  items: StatusStripItem[];
}

export function StatusStrip({ items }: StatusStripProps) {
  return (
    <ul className="os-stat-strip" data-count={items.length}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col items-start gap-os-1 rounded-os-s bg-os-surface-2 px-os-3 py-os-2"
        >
          <span
            className="font-os text-os-text-2"
            style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
          >
            {item.label}
          </span>
          <span
            className="os-num font-os font-semibold text-os-text"
            style={{ fontSize: 'var(--os-fs-num-lg)', lineHeight: 'var(--os-lh-num-lg)' }}
          >
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
