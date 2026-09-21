import { useEffect, useRef, useState } from 'react';
import { Button, RadioGroup, RadioGroupItem } from '@offside/ui';
import type { PlayerDraft, PlayerGender, Position, PreferredFoot, Ruleset } from '@offside/domain';
import { Link } from '@tanstack/react-router';
import { useUiStore } from './ui-store.js';
import { GENDER_LABELS, POSITION_LABELS, PREFERRED_FOOT_LABELS } from './labels.js';
import { backgroundOpening, validateDraftName } from './player-draft.js';
import { NationalitySelector } from './nationality-selector.js';
import './creation-flow.css';

export type CreationValues = {
  name: string;
  gender: PlayerGender;
  nationalityCode: string;
  preferredFoot: PreferredFoot;
  position: Position;
  backgroundId: string;
};
const NAMES = [
  '한도윤',
  '윤서진',
  '이하준',
  '강지우',
  '김시온',
  '서유찬',
  '차민재',
  '정수현',
  '박선우',
  '최이안',
  '이예준',
  '임다온',
];
export function CreationForm({
  draft,
  ruleset,
  storageKey,
  busy,
  error,
  onSubmit,
}: {
  draft?: PlayerDraft;
  ruleset: Ruleset;
  storageKey: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: CreationValues) => void;
}) {
  const defaults: CreationValues = {
    name: draft?.name ?? '',
    gender: draft?.gender ?? 'UNSPECIFIED',
    nationalityCode: draft?.nationalityCode ?? 'KR',
    preferredFoot: draft?.preferredFoot ?? 'RIGHT',
    position: draft?.position ?? 'ST',
    backgroundId: draft?.backgroundId ?? ruleset.backgrounds[0]!.id,
  };
  const [form, setForm] = useState<CreationValues>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (saved?.version === 2 && saved.form && typeof saved.form === 'object') {
        saved.form = {
          ...defaults,
          ...Object.fromEntries(Object.entries(saved.form).filter(([, value]) => value !== null)),
        };
        saved.version = 3;
      }
      if (
        saved?.version === 3 &&
        typeof saved.form?.name === 'string' &&
        ['FEMALE', 'MALE', 'UNSPECIFIED'].includes(saved.form.gender) &&
        ['LEFT', 'RIGHT', 'BOTH'].includes(saved.form.preferredFoot) &&
        ruleset.positions.includes(saved.form.position) &&
        ruleset.nationalities.some((n) => n.code === saved.form.nationalityCode) &&
        ruleset.backgrounds.some((b) => b.id === saved.form.backgroundId)
      )
        return saved.form as CreationValues;
    } catch {
      /* use saved engine draft */
    }
    return defaults;
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ version: 3, form }));
    } catch {
      /* local form remains usable */
    }
  }, [storageKey, form]);
  function update<K extends keyof CreationValues>(key: K, value: CreationValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'name') setNameError(null);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = validateDraftName(form.name, ruleset.draftRules);
    if (!result.ok) {
      setNameError(result.message);
      nameRef.current?.focus();
      return;
    }
    onSubmit({ ...form, name: form.name.trim() });
  }
  const background = ruleset.backgrounds.find((b) => b.id === form.backgroundId)!;
  return (
    <form className="creation-flow" onSubmit={submit}>
      <header className="creation-heading">
        <div>
          <p>NEW CAREER · 01</p>
          <h1>선수 생성</h1>
        </div>
        <Link
          to="/"
          aria-label="선수 생성 닫기"
          onClick={() => useUiStore.getState().setOnboardingSeen(true)}
        >
          ✕
        </Link>
      </header>
      <p className="creation-lead">12시즌에 담을 나만의 축구 인생. 이름부터 정해 보세요.</p>
      <div className="creation-identity">
        <label htmlFor="draft-name">이름</label>
        <button
          type="button"
          className="creation-random"
          disabled={busy}
          onClick={() => {
            const random = new Uint32Array(1);
            crypto.getRandomValues(random);
            update('name', NAMES[random[0]! % NAMES.length]!);
          }}
        >
          랜덤 이름 ↻
        </button>
        <input
          id="draft-name"
          ref={nameRef}
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          maxLength={ruleset.draftRules.nameMax}
          placeholder="경기장에서 불릴 이름"
          autoComplete="off"
          disabled={busy}
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? 'draft-name-error' : undefined}
        />
      </div>
      {nameError && (
        <p id="draft-name-error" role="alert" className="creation-error">
          {nameError}
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>주발</legend>
        <RadioGroup
          className="creation-segments"
          aria-label="주발"
          value={form.preferredFoot}
          onValueChange={(v) => update('preferredFoot', v as PreferredFoot)}
        >
          {(['RIGHT', 'LEFT', 'BOTH'] as const).map((foot) => (
            <RadioGroupItem key={foot} value={foot}>
              {PREFERRED_FOOT_LABELS[foot]}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>포지션</legend>
        <RadioGroup
          className="creation-positions"
          aria-label="포지션"
          value={form.position}
          onValueChange={(v) => update('position', v as Position)}
        >
          {ruleset.positions.map((position) => (
            <RadioGroupItem key={position} value={position}>
              <b>{position}</b>
              <span>{POSITION_LABELS[position]}</span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="creation-field">
        <label htmlFor="draft-background">출발 배경</label>
        <select
          id="draft-background"
          value={form.backgroundId}
          disabled={busy}
          onChange={(e) => update('backgroundId', e.target.value)}
        >
          {ruleset.backgrounds.map((b) => (
            <option key={b.id} value={b.id}>
              {backgroundOpening(b.id, b.name).title}
            </option>
          ))}
        </select>
      </div>
      <details className="creation-extra">
        <summary>
          상세 프로필{' '}
          <span>
            {ruleset.nationalities.find((n) => n.code === form.nationalityCode)?.name} ·{' '}
            {GENDER_LABELS[form.gender]}
          </span>
        </summary>
        <p className="creation-note">{background.blurb}</p>
        <div className="creation-two">
          <label>
            국적
            <NationalitySelector
              options={ruleset.nationalities}
              disabled={busy}
              value={form.nationalityCode}
              onChange={(code) => update('nationalityCode', code)}
            />
          </label>
          <label>
            성별
            <select
              aria-label="성별"
              disabled={busy}
              value={form.gender}
              onChange={(e) => update('gender', e.target.value as PlayerGender)}
            >
              {(['UNSPECIFIED', 'FEMALE', 'MALE'] as const).map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      {error && (
        <p role="alert" className="creation-error">
          {error}
        </p>
      )}
      <div className="creation-action">
        <Button type="submit" disabled={busy}>
          {busy ? '선수를 준비하는 중…' : '다음 · 후보 카드 열기'}
          <span aria-hidden="true"> →</span>
        </Button>
      </div>
    </form>
  );
}
