// SCR-002 선수 정보. 이름·성별·국적·주발·선호 포지션·배경 6개 필드를 한 번의 UPDATE_PLAYER_DRAFT로 저장한다
// (키 입력마다 명령을 보내지 않는다). 포지션이 바뀌어 기존 archetypeId가 새 포지션과 맞지 않으면
// 같은 명령에 archetypeId: null을 함께 보낸다(SCR-003 인수 조건).
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  ChoiceCard,
  ErrorState,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@offside/ui';
import { RETRYABLE_BY_CODE } from '@offside/contracts';
import {
  positionGroupOf,
  type PlayerDraft,
  type PlayerGender,
  type Position,
  type PositionGroup,
  type PreferredFoot,
} from '@offside/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { activeRuleset, rulesetForCareer } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import {
  GENDER_LABELS,
  POSITION_DESCRIPTIONS,
  POSITION_GROUP_LABELS,
  POSITION_LABELS,
  PREFERRED_FOOT_LABELS,
} from '../shared/labels.js';
import {
  backgroundEffectLines,
  backgroundOpening,
  backgroundRiskLevel,
  creationAgeWord,
  PLAYER_CREATION_CAREER_PHASE,
  positionsByGroup,
  RISK_LABELS,
  shouldResetArchetype,
  sortNationalities,
  validateDraftName,
} from '../shared/player-draft.js';
import { useScreenState } from '../shared/screen-state.js';
import { resolveTeamName } from '../shared/team-names.js';
import { useUiStore } from '../shared/ui-store.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';
import { CreationStage, PositionPitch } from '../shared/player-creation-ui.js';

export const Route = createFileRoute('/career/$careerId/create')({
  component: CreatePlayerScreen,
});

type FormFields = {
  name: string;
  gender: PlayerGender | '';
  nationalityCode: string;
  preferredFoot: PreferredFoot | '';
  position: Position | '';
  backgroundId: string;
};

const EMPTY_FORM: FormFields = {
  name: '',
  gender: '',
  nationalityCode: '',
  preferredFoot: '',
  position: '',
  backgroundId: '',
};

const GENDER_OPTIONS = ['FEMALE', 'MALE', 'UNSPECIFIED'] as const satisfies readonly PlayerGender[];

type FieldErrors = Partial<Record<keyof FormFields, string>>;
type CreationPanel = 0 | 1 | 2;
type CreationScratch = { form: FormFields; panel: CreationPanel; version?: 2 };

const CREATION_PANELS = [0, 1, 2] as const satisfies readonly CreationPanel[];
/** 패널별로 화면에 보이는(= 그 패널에서 검증·안내하는) 필드. */
const PANEL_FIELDS: Record<CreationPanel, ReadonlyArray<keyof FormFields>> = {
  0: ['backgroundId'],
  1: ['name', 'gender', 'nationalityCode', 'preferredFoot'],
  2: ['position'],
};

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;
const FIELD_CLASS =
  'os-input w-full font-os text-os-text disabled:cursor-not-allowed disabled:opacity-60';
const FIELD_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

function isCreationScratch(value: unknown, ruleset: typeof activeRuleset): value is CreationScratch {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { form?: unknown; panel?: unknown; version?: unknown };
  if (candidate.panel !== 0 && candidate.panel !== 1 && candidate.panel !== 2) return false;
  if (candidate.version !== undefined && candidate.version !== 2) return false;
  if (typeof candidate.form !== 'object' || candidate.form === null) return false;
  const form = candidate.form as Partial<Record<keyof FormFields, unknown>>;
  if ((Object.keys(EMPTY_FORM) as Array<keyof FormFields>).some((key) => typeof form[key] !== 'string')) return false;
  return (
    (form.gender === '' || GENDER_OPTIONS.includes(form.gender as PlayerGender)) &&
    (form.preferredFoot === '' || ['LEFT', 'RIGHT', 'BOTH'].includes(form.preferredFoot as string)) &&
    (form.position === '' || ruleset.positions.includes(form.position as Position)) &&
    (form.nationalityCode === '' || ruleset.nationalities.some((item) => item.code === form.nationalityCode)) &&
    (form.backgroundId === '' || ruleset.backgrounds.some((item) => item.id === form.backgroundId))
  );
}

function validateForm(form: FormFields, ruleset: typeof activeRuleset): FieldErrors {
  const errors: FieldErrors = {};
  const name = validateDraftName(form.name, ruleset.draftRules);
  if (!name.ok) errors.name = name.message;
  if (form.gender === '') errors.gender = '성별을 선택해 주세요.';
  if (form.nationalityCode === '') errors.nationalityCode = '국적을 선택해 주세요.';
  if (form.preferredFoot === '') errors.preferredFoot = '주발을 선택해 주세요.';
  if (form.position === '') errors.position = '선호 포지션을 선택해 주세요.';
  if (form.backgroundId === '') errors.backgroundId = '배경을 선택해 주세요.';
  return errors;
}

function CreatePlayerScreen() {
  const { careerId } = Route.useParams();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const ruleset = query.data === undefined ? activeRuleset : rulesetForCareer(query.data.state);
  const teamNameOverrides = useUiStore((uiState) => uiState.teamNameOverrides);
  const positionGroups = positionsByGroup(ruleset.positions);
  const nationalityOptions = sortNationalities(ruleset.nationalities);
  const blocked = useCareerStepGuard(query.data?.state, 'SCR-002');
  const updateDraftMutation = useCareerMutation('updateDraft');

  const screen = useScreenState<never, Record<string, never>>({ kind: 'LOADING' });
  const { state: screenState, toDraft, toCommitting, toError } = screen;

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [panel, setPanel] = useState<CreationPanel>(0);
  const [positionGroup, setPositionGroup] = useState<PositionGroup>('GK');
  const [errors, setErrors] = useState<FieldErrors>({});
  const seededRef = useRef(false);
  const focusPanelHeadingRef = useRef(false);
  const submitAttemptedRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nationalitySelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-002',
      careerPhase: PLAYER_CREATION_CAREER_PHASE,
    });
  }, []);

  useEffect(() => {
    if (blocked || query.data === undefined || seededRef.current) return;
    seededRef.current = true;
    const draft = query.data.state.player.draft;
    const savedForm: FormFields = {
      name: draft.name ?? '',
      gender: draft.gender ?? '',
      nationalityCode: draft.nationalityCode ?? '',
      preferredFoot: draft.preferredFoot ?? '',
      position: draft.position ?? '',
      backgroundId: draft.backgroundId ?? '',
    };
    let restored: CreationScratch | undefined;
    try {
      const raw = sessionStorage.getItem(`offside:player-creation:${careerId}`);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isCreationScratch(parsed, ruleset)) restored = parsed;
      }
    } catch {
      // 손상되거나 사용할 수 없는 scratch는 엔진에 저장된 draft로 안전하게 복구한다.
    }
    const nextForm = restored?.form ?? savedForm;
    setForm(nextForm);
    const restoredPanel = restored === undefined
      ? 0
      : restored.version === 2
        ? restored.panel
        : restored.panel === 0 ? 1 : restored.panel === 1 ? 2 : 0;
    setPanel(restoredPanel);
    setPositionGroup(nextForm.position ? positionGroupOf(nextForm.position) : 'GK');
    toDraft({});
  }, [blocked, careerId, query.data, toDraft]);

  useEffect(() => {
    if (!seededRef.current || screenState.kind !== 'DRAFT') return;
    try {
      sessionStorage.setItem(`offside:player-creation:${careerId}`, JSON.stringify({ form, panel, version: 2 } satisfies CreationScratch));
    } catch {
      // 저장 공간이 막힌 환경에서도 폼 자체는 계속 사용할 수 있다.
    }
  }, [careerId, form, panel, screenState.kind]);

  useEffect(() => {
    if (!focusPanelHeadingRef.current) return;
    focusPanelHeadingRef.current = false;
    document.getElementById(panel === 0 ? 'draft-background-heading' : panel === 1 ? 'draft-identity-heading' : 'draft-position-heading')?.focus();
  }, [panel]);

  const committing = screenState.kind === 'COMMITTING';
  // 이슈 158: 제출 시도 뒤 이 패널에 아직 보이는 오류가 있으면 다음을 비활성화한다(오류는 아래
  // updateField가 필드 변경마다 지우므로 고치는 즉시 다시 활성화된다). 첫 제출 전에는 비활성화하지
  // 않는다 — 빈 폼 제출이 오류 안내·첫 오류 필드 포커스로 이어지는 기존 동작을 유지한다.
  const hasVisibleErrors = PANEL_FIELDS[panel].some((key) => errors[key] !== undefined);
  const selectedBackground = ruleset.backgrounds.find((background) => background.id === form.backgroundId);
  const selectedOpening = selectedBackground === undefined
    ? undefined
    : backgroundOpening(selectedBackground.id, selectedBackground.name);
  const savedDraft = query.data?.state.player.draft;
  const hasUnsavedChanges = savedDraft !== undefined &&
    (Object.keys(EMPTY_FORM) as Array<keyof FormFields>).some(
      (key) => form[key] !== (savedDraft[key] ?? ''),
    );

  // 이슈 153 원인: 오류가 제출 시점(validateCurrentPanel·handleNext)에만 계산되고 필드 change에서는
  // 폼 값만 바뀌어 "선택해 주세요"가 값을 고른 뒤에도 남아 있었다. 수정: 그 패널에서 한 번 제출을
  // 시도한 뒤에는 바뀐 필드를 change마다 재검증해 유효해지는 즉시 지우고, 이름처럼 메시지가 달라지면
  // (길이 → 등장인물 이름 등) 갱신한다. 첫 제출 전에는 입력 중에 미리 경고하지 않는다.
  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (!submitAttemptedRef.current) return;
    const message = validateForm({ ...form, [key]: value }, ruleset)[key];
    if (message === errors[key]) return;
    setErrors((current) => {
      const next = { ...current };
      if (message === undefined) delete next[key];
      else next[key] = message;
      return next;
    });
  }

  function handlePositionGroupChange(nextGroup: PositionGroup) {
    setPositionGroup(nextGroup);
  }

  function validateCurrentPanel(): boolean {
    submitAttemptedRef.current = true;
    const all = validateForm(form, ruleset);
    const nextErrors: FieldErrors = {};
    for (const key of PANEL_FIELDS[panel]) {
      const message = all[key];
      if (message !== undefined) nextErrors[key] = message;
    }
    setErrors(nextErrors);
    if (nextErrors.name) nameInputRef.current?.focus();
    else if (nextErrors.nationalityCode) nationalitySelectRef.current?.focus();
    return Object.keys(nextErrors).length === 0;
  }

  function handlePanelNext() {
    if (!validateCurrentPanel()) return;
    submitAttemptedRef.current = false;
    focusPanelHeadingRef.current = true;
    setPanel((current) => (current === 0 ? 1 : 2));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handlePanelBack() {
    submitAttemptedRef.current = false;
    setErrors({});
    focusPanelHeadingRef.current = true;
    setPanel((current) => (current === 2 ? 1 : 0));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function handleNext() {
    submitAttemptedRef.current = true;
    const validationErrors = validateForm(form, ruleset);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      // 앞 패널 필드(복원된 scratch의 예약 이름 등)가 틀렸으면 그 패널로 되돌려 안내가 보이게 한다.
      const errorPanel =
        CREATION_PANELS.find((candidate) => PANEL_FIELDS[candidate].some((key) => validationErrors[key] !== undefined)) ?? panel;
      if (errorPanel !== panel) {
        focusPanelHeadingRef.current = true;
        setPanel(errorPanel);
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }
      if (validationErrors.name) {
        nameInputRef.current?.focus();
      } else if (validationErrors.nationalityCode) {
        nationalitySelectRef.current?.focus();
      }
      return;
    }

    const commandId = crypto.randomUUID();
    toCommitting(commandId);

    const currentArchetypeId = query.data?.state.player.draft.archetypeId ?? null;
    const position = form.position as Position;
    const resetArchetype = shouldResetArchetype(ruleset, position, currentArchetypeId);

    const draftPatch: Partial<PlayerDraft> = {
      name: form.name.trim(),
      gender: form.gender as PlayerGender,
      nationalityCode: form.nationalityCode,
      preferredFoot: form.preferredFoot as PreferredFoot,
      position,
      backgroundId: form.backgroundId,
      ...(resetArchetype ? { archetypeId: null } : {}),
    };

    try {
      const result = await updateDraftMutation.mutateAsync({ careerId, draft: draftPatch });
      if (result.ok) {
        try { sessionStorage.removeItem(`offside:player-creation:${careerId}`); } catch { /* no-op */ }
        void navigate({ to: '/career/$careerId/style', params: { careerId } });
      } else {
        toError({
          code: result.error.code,
          message: result.error.message,
          retryable: RETRYABLE_BY_CODE[result.error.code],
        });
      }
    } catch {
      toError({
        code: 'UNKNOWN',
        message: '저장하지 못했습니다. 다시 시도해 주세요.',
        retryable: true,
      });
    }
  }

  if (blocked || screenState.kind === 'LOADING' || query.data === undefined) {
    return (
      <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
      </div>
    );
  }

  if (screenState.kind === 'ERROR') {
    return (
      <ErrorState
        message={screenState.message}
        {...(screenState.retryable ? { onRetry: () => void handleNext() } : {})}
        recoveryAction={
          <Button
            variant="secondary"
            onClick={() => {
              submitAttemptedRef.current = false;
              setErrors({});
              setPanel(0);
              toDraft({});
            }}
          >
            입력으로 돌아가기
          </Button>
        }
      />
    );
  }

  return (
    <div className="os-screen">
      <section className="os-creation-prologue" aria-labelledby="creation-prologue-title">
        <p className="os-eyebrow">새 인생 · {query.data.state.age}세</p>
        <h1 id="creation-prologue-title">다음 무대를 향해, 킥오프</h1>
        {panel === 0 ? (
          <p>
            {creationAgeWord(query.data.state.age)}. 지금까지 훈련해 온 환경은 저마다 다르다. 아카데미의
            추가 평가, 학교팀에서 만든 기록, 지역 무대에서 온 훈련 초대 가운데 이 선수의 출발점을
            고른다.
          </p>
        ) : (
          <p>
            {selectedOpening?.title ?? '선택한 배경'}에서 커리어가 시작된다. 아직 계약이나 출전 역할은
            정해지지 않았다.
          </p>
        )}
      </section>

      <p className="os-creation-step-caption">
        선수 등록 · {panel + 1}/3 · {panel === 0 ? '첫 출발점' : panel === 1 ? '정체성' : '선호 위치'}
      </p>

      <ol className="os-creation-panel-progress" aria-label={`선수 정보 ${panel + 1} / 3`}>
        {['첫 출발점', '정체성', '선호 위치'].map((label, index) => (
          <li key={label} aria-current={index === panel ? 'step' : undefined} data-complete={index < panel}>{label}</li>
        ))}
      </ol>

      {panel === 1 ? (
      <CreationStage
        number="02"
        eyebrow="Identity"
        title="나를 소개하세요"
        description="선수의 정체성을 정하세요. 성별은 능력치와 성장에 영향을 주지 않습니다."
        labelledBy="draft-identity-heading"
      >
        <div className="flex flex-col gap-os-3">
          <label
            htmlFor="draft-name"
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            이름
          </label>
          <input
            id="draft-name"
            ref={nameInputRef}
            type="text"
            placeholder="경기장에서 불릴 이름"
            autoComplete="off"
            className={FIELD_CLASS}
            style={FIELD_STYLE}
            value={form.name}
            maxLength={ruleset.draftRules.nameMax}
            disabled={committing}
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name !== undefined ? 'draft-name-error' : undefined}
            onChange={(event) => updateField('name', event.target.value)}
          />
          {errors.name !== undefined ? (
            <p
              id="draft-name-error"
              role="alert"
              className="font-os text-os-danger"
              style={CAPTION_STYLE}
            >
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-os-3">
          <h2
            id="draft-gender-heading"
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            성별
          </h2>
          <RadioGroup
            className="os-segmented"
            aria-labelledby="draft-gender-heading"
            aria-describedby={[
              errors.gender !== undefined ? 'draft-gender-error' : undefined,
            ]
              .filter((id): id is string => id !== undefined)
              .join(' ')}
            value={form.gender}
            onValueChange={(value) => updateField('gender', value as PlayerGender)}
          >
            {GENDER_OPTIONS.map((gender) => (
              <RadioGroupItemRow
                key={gender}
                value={gender}
                label={GENDER_LABELS[gender]}
                disabled={committing}
              />
            ))}
          </RadioGroup>
          {errors.gender !== undefined ? (
            <p
              id="draft-gender-error"
              role="alert"
              className="font-os text-os-danger"
              style={CAPTION_STYLE}
            >
              {errors.gender}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-os-3">
          <label
            htmlFor="draft-nationality"
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            국적
          </label>
          <select
            id="draft-nationality"
            ref={nationalitySelectRef}
            className={FIELD_CLASS}
            style={FIELD_STYLE}
            value={form.nationalityCode}
            disabled={committing}
            aria-invalid={errors.nationalityCode !== undefined}
            aria-describedby={
              errors.nationalityCode !== undefined ? 'draft-nationality-error' : undefined
            }
            onChange={(event) => updateField('nationalityCode', event.target.value)}
          >
            <option value="">국적을 선택하세요</option>
            {nationalityOptions.map((nationality) => (
              <option key={nationality.code} value={nationality.code}>
                {nationality.name}
              </option>
            ))}
          </select>
          {errors.nationalityCode !== undefined ? (
            <p
              id="draft-nationality-error"
              role="alert"
              className="font-os text-os-danger"
              style={CAPTION_STYLE}
            >
              {errors.nationalityCode}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-os-3">
          <h2
            id="draft-foot-heading"
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            주발
          </h2>
          <RadioGroup
            className="os-segmented"
            aria-labelledby="draft-foot-heading"
            aria-describedby={errors.preferredFoot !== undefined ? 'draft-foot-error' : undefined}
            value={form.preferredFoot}
            onValueChange={(value) => updateField('preferredFoot', value as PreferredFoot)}
          >
            {(['LEFT', 'RIGHT', 'BOTH'] as const).map((foot) => (
              <RadioGroupItemRow
                key={foot}
                value={foot}
                label={PREFERRED_FOOT_LABELS[foot]}
                disabled={committing}
              />
            ))}
          </RadioGroup>
          {errors.preferredFoot !== undefined ? (
            <p
              id="draft-foot-error"
              role="alert"
              className="font-os text-os-danger"
              style={CAPTION_STYLE}
            >
              {errors.preferredFoot}
            </p>
          ) : null}
        </div>
      </CreationStage>
      ) : null}

      {panel === 2 ? (
      <CreationStage
        number="03"
        eyebrow="Preference"
        title="내가 가장 뛰고 싶은 위치"
        description="선호 포지션은 출발점입니다. 실제 역할과 출전 위치는 성장, 선택, 팀 상황에 따라 달라질 수 있어요."
        labelledBy="draft-position-heading"
      >
        {/* 08 출시 차단 기준(키보드로 P0 흐름 완료 불가): 이 Tabs는 포지션 RadioGroup 밖의 형제로
            둔다. 이전엔 RadioGroup 안에 중첩돼 Radix의 두 roving-tabindex 관리자가 충돌해 트리거
            4개 전부가 tabindex="-1"이 되어 Tab으로 도달할 수 없었다. TabsContent는 실제 포지션
            목록(아래 RadioGroup)을 담지 않고 비워 둔다 — TabsTrigger의 aria-controls가 가리키는
            id를 만들어 주는 용도뿐이다(axe aria-valid-attr-value). tabIndex=-1로 빈 패널이 Tab
            순서에 끼어들지 않게 한다(Radix 기본은 role="tabpanel"에 tabindex="0"을 준다). */}
        <Tabs value={positionGroup} onValueChange={(value) => handlePositionGroupChange(value as PositionGroup)}>
          <TabsList aria-label="포지션 구분">
            {positionGroups.map(({ group }) => <TabsTrigger key={group} value={group}>{POSITION_GROUP_LABELS[group]}</TabsTrigger>)}
          </TabsList>
          {positionGroups.map(({ group }) => <TabsContent key={group} value={group} tabIndex={-1} />)}
        </Tabs>
        <div className="os-creation-two-up">
          <div className="flex flex-col gap-os-3">
            <RadioGroup
              className="os-choice-grid os-creation-position-choices"
              aria-labelledby="draft-position-heading"
              aria-describedby={errors.position !== undefined ? 'draft-position-error' : undefined}
              value={form.position}
              onValueChange={(value) => updateField('position', value as Position)}
            >
              {(positionGroups.find((entry) => entry.group === positionGroup)?.positions ?? []).map((position) => (
                <RadioGroupItemRow key={position} value={position} label={POSITION_LABELS[position]} description={POSITION_DESCRIPTIONS[position]} disabled={committing} />
              ))}
            </RadioGroup>
          </div>
          <PositionPitch
            position={form.position}
            {...(form.position === '' ? {} : { label: POSITION_LABELS[form.position] })}
          />
        </div>
        {errors.position !== undefined ? (
          <p
            id="draft-position-error"
            role="alert"
            className="font-os text-os-danger"
            style={CAPTION_STYLE}
          >
            {errors.position}
          </p>
        ) : null}
      </CreationStage>
      ) : null}

      {panel === 0 ? (
      <CreationStage
        number="01"
        eyebrow="Origin"
        title="어떤 환경에서 출발했나요?"
        description="첫 상황은 출발 배경과 초기 능력에 실제로 연결됩니다. 효과를 확인하고 고르세요."
        labelledBy="draft-background-heading"
      >
        <RadioGroup
          aria-labelledby="draft-background-heading"
          aria-describedby={
            errors.backgroundId !== undefined ? 'draft-background-error' : undefined
          }
          value={form.backgroundId}
          onValueChange={(value) => updateField('backgroundId', value)}
        >
          {ruleset.backgrounds.map((background) => {
            const riskLevel = backgroundRiskLevel(background.id);
            const startTeamName =
              resolveTeamName(ruleset, background.startTeamId, teamNameOverrides) ??
              background.startTeamId;
            const opening = backgroundOpening(background.id, background.name);
            return (
              <ChoiceCard
                key={background.id}
                value={background.id}
                disabled={committing}
                label={opening.title}
                riskLevel={riskLevel}
                riskLabel={RISK_LABELS[riskLevel]}
                effects={[
                  opening.situation,
                  `시작 팀: ${startTeamName}`,
                ]}
                selectedLabel="선택됨"
              />
            );
          })}
        </RadioGroup>
        {selectedBackground !== undefined && selectedOpening !== undefined ? (
          <aside className="os-creation-note" aria-live="polite">
            <strong className="block text-os-text">{selectedOpening.title} · {selectedBackground.name}</strong>
            <span className="mt-os-1 block">{selectedBackground.blurb}</span>
            <span className="mt-os-2 block font-semibold text-os-text">
              {backgroundEffectLines(selectedBackground.attributeDeltas).join(' · ')}
            </span>
          </aside>
        ) : null}
        {errors.backgroundId !== undefined ? (
          <p
            id="draft-background-error"
            role="alert"
            className="font-os text-os-danger"
            style={CAPTION_STYLE}
          >
            {errors.backgroundId}
          </p>
        ) : null}
      </CreationStage>
      ) : null}

      <div className={`os-action-dock ${panel > 0 ? 'os-action-row' : ''}`}>
        {panel > 0 ? (
          <Button variant="secondary" onClick={handlePanelBack} disabled={committing}>이전</Button>
        ) : null}
        <Button
          variant="primary"
          onClick={panel === 2 ? () => void handleNext() : handlePanelNext}
          disabled={committing || hasVisibleErrors}
          className={panel === 0 ? 'w-full' : undefined}
          {...(panel === 2 ? { 'aria-describedby': 'draft-save-notice' } : {})}
        >
          {committing ? '저장하는 중' : panel === 2 ? '플레이 스타일 고르기' : '다음'}
        </Button>
      </div>
      {panel === 2 ? (
        <p id="draft-save-notice" role="status" className="os-muted text-center" style={CAPTION_STYLE}>
          {committing
            ? '입력 정보를 저장하고 있어요.'
            : hasUnsavedChanges
              ? '아직 저장하지 않은 변경사항이 있어요. 다음을 눌러 저장하세요.'
              : '다음을 누르면 입력 정보가 저장돼요.'}
        </p>
      ) : null}
    </div>
  );
}

function RadioGroupItemRow({
  value,
  label,
  description,
  disabled,
}: {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <RadioGroupItem value={value} disabled={disabled} className="p-os-3">
      <span
        className="block font-os font-semibold text-os-text"
        style={{
          fontSize: description === undefined ? 'var(--os-fs-caption)' : 'var(--os-fs-body)',
          lineHeight: description === undefined ? 'var(--os-lh-caption)' : 'var(--os-lh-body)',
        }}
      >
        {label}
      </span>
      {description !== undefined ? (
        <span className="block font-os text-os-text-2" style={CAPTION_STYLE}>
          {description}
        </span>
      ) : null}
    </RadioGroupItem>
  );
}
