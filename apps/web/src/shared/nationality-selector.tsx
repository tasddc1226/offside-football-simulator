import { useMemo, useState } from 'react';

export type NationalityOption = { code: string; name: string };

/** Searchable, deterministic nationality picker. Korean is always first when present. */
export function NationalitySelector({
  options,
  value,
  disabled,
  onChange,
}: {
  options: readonly NationalityOption[];
  value: string;
  disabled?: boolean;
  onChange: (code: string) => void;
}) {
  const [query, setQuery] = useState('');
  const ordered = useMemo(
    () =>
      [...options].sort((a, b) => {
        if (a.code === 'KR') return -1;
        if (b.code === 'KR') return 1;
        return a.name.localeCompare(b.name, 'ko') || a.code.localeCompare(b.code);
      }),
    [options],
  );
  const filtered = ordered.filter((option) => {
    const needle = query.trim().toLocaleLowerCase();
    return (
      needle === '' ||
      option.name.toLocaleLowerCase().includes(needle) ||
      option.code.toLocaleLowerCase().includes(needle)
    );
  });
  return (
    <div className="creation-nationality-selector">
      <input
        aria-label="국적 검색"
        type="search"
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="국가명·코드 검색"
      />
      <select
        aria-label="국적"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {filtered.map((option) => (
          <option value={option.code} key={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
