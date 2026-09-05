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
  ScreenIntro,
  Skeleton,
  Stepper,
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
import { activeRuleset as ruleset } from '../engine/content.js';
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
  backgroundRiskLevel,
  PLAYER_CREATION_CAREER_PHASE,
  PLAYER_CREATION_STEPS,
  positionsByGroup,
  RISK_LABELS,
  shouldResetArchetype,
  validateDraftName,
} from '../shared/player-draft.js';
import { useScreenState } from '../shared/screen-state.js';
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
type CreationScratch = { form: FormFields; panel: CreationPanel };

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;
const FIELD_CLASS =
  'os-input w-full font-os text-os-text disabled:cursor-not-allowed disabled:opacity-60';
const FIELD_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

const POSITION_GROUPS = positionsByGroup(ruleset.positions);

function isCreationScratch(value: unknown): value is CreationScratch {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { form?: unknown; panel?: unknown };
  if (candidate.panel !== 0 && candidate.panel !== 1 && candidate.panel !== 2) return false;
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

function validateForm(form: FormFields): FieldErrors {
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
        if (isCreationScratch(parsed)) restored = parsed;
      }
    } catch {
      // 손상되거나 사용할 수 없는 scratch는 엔진에 저장된 draft로 안전하게 복구한다.
    }
    const nextForm = restored?.form ?? savedForm;
    setForm(nextForm);
    setPanel(restored?.panel === 1 || restored?.panel === 2 ? restored.panel : 0);
    setPositionGroup(nextForm.position ? positionGroupOf(nextForm.position) : 'GK');
    toDraft({});
  }, [blocked, careerId, query.data, toDraft]);

  useEffect(() => {
    if (!seededRef.current || screenState.kind !== 'DRAFT') return;
    try {
      sessionStorage.setItem(`offside:player-creation:${careerId}`, JSON.stringify({ form, panel } satisfies CreationScratch));
    } catch {
      // 저장 공간이 막힌 환경에서도 폼 자체는 계속 사용할 수 있다.
    }
  }, [careerId, form, panel, screenState.kind]);

  useEffect(() => {
    if (!focusPanelHeadingRef.current) return;
    focusPanelHeadingRef.current = false;
    document.getElementById(panel === 0 ? 'draft-identity-heading' : panel === 1 ? 'draft-position-heading' : 'draft-background-heading')?.focus();
  }, [panel]);

  const committing = screenState.kind === 'COMMITTING';
  const savedDraft = query.data?.state.player.draft;
  const hasUnsavedChanges = savedDraft !== undefined &&
    (Object.keys(EMPTY_FORM) as Array<keyof FormFields>).some(
      (key) => form[key] !== (savedDraft[key] ?? ''),
    );

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handlePositionGroupChange(nextGroup: PositionGroup) {
    setPositionGroup(nextGroup);
  }

  function validateCurrentPanel(): boolean {
    const all = validateForm(form);
    const keys: Array<keyof FormFields> = panel === 0
      ? ['name', 'gender', 'nationalityCode', 'preferredFoot']
      : panel === 1 ? ['position'] : ['backgroundId'];
    const nextErrors: FieldErrors = {};
    for (const key of keys) {
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
    focusPanelHeadingRef.current = true;
    setPanel((current) => (current === 0 ? 1 : 2));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handlePanelBack() {
    setErrors({});
    focusPanelHeadingRef.current = true;
    setPanel((current) => (current === 2 ? 1 : 0));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function handleNext() {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
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

  if (blocked || screenState.kind === 'LOADING') {
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
      <Stepper steps={PLAYER_CREATION_STEPS} currentStepId="info" />
      <ScreenIntro
        eyebrow="새 커리어 · 1/3"
        title="선수 정보를 입력하세요"
        description={`${panel + 1}/3 · ${panel === 0 ? '정체성' : panel === 1 ? '선호 위치' : '출발 배경'}`}
      />

      <ol className="os-creation-panel-progress" aria-label={`선수 정보 ${panel + 1} / 3`}>
        {['정체성', '선호 위치', '출발 배경'].map((label, index) => (
          <li key={label} aria-current={index === panel ? 'step' : undefined} data-complete={index < panel}>{label}</li>
        ))}
      </ol>

      {panel === 0 ? (
      <CreationStage
        number="01"
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
            {ruleset.nationalities.map((nationality) => (
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

      {panel === 1 ? (
      <CreationStage
        number="02"
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
            {POSITION_GROUPS.map(({ group }) => <TabsTrigger key={group} value={group}>{POSITION_GROUP_LABELS[group]}</TabsTrigger>)}
          </TabsList>
          {POSITION_GROUPS.map(({ group }) => <TabsContent key={group} value={group} tabIndex={-1} />)}
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
              {(POSITION_GROUPS.find((entry) => entry.group === positionGroup)?.positions ?? []).map((position) => (
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

      {panel === 2 ? (
      <CreationStage
        number="03"
        eyebrow="Origin"
        title="축구를 시작한 곳"
        description="배경은 시작 팀과 초기 능력에 실제로 영향을 줍니다. 효과를 비교해 선택하세요."
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
            const startTeam = ruleset.teams.find((team) => team.id === background.startTeamId);
            return (
              <ChoiceCard
                key={background.id}
                value={background.id}
                disabled={committing}
                label={background.name}
                riskLevel={riskLevel}
                riskLabel={RISK_LABELS[riskLevel]}
                effects={[
                  background.blurb,
                  ...backgroundEffectLines(background.attributeDeltas),
                  `시작 팀: ${startTeam?.name ?? background.startTeamId}`,
                ]}
                selectedLabel="선택됨"
              />
            );
          })}
        </RadioGroup>
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
          disabled={committing}
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
