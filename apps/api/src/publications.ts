import {
  CareerArticleSchema,
  CareerStateSchema,
  GetCareerResponseSchema,
  type CareerArticle,
} from '@offside/contracts';
import { loadContentPack, loadRetirementArtifacts, loadRuleset } from '@offside/content';
import {
  canonicalize,
  type JsonValue,
  planCareerArchiveWrite,
  simulate,
  type CareerArchiveCore,
  type Command,
  type DomainSnapshot,
} from '@offside/domain';
import type { CareerRecord } from './db/repos/careers.js';
import { AppError } from './errors.js';

export function articleFromArchive(
  career: CareerRecord,
  archiveJson: string,
  seed: string,
  simulationMode: CareerArticle['challenge']['simulationMode'],
  id: string,
  now: string,
): CareerArticle {
  try {
    const archive = JSON.parse(archiveJson) as CareerArchiveCore;
    const state = CareerStateSchema.parse(JSON.parse(archive.source.state));
    const context = {
      binding: {
        careerId: career.id,
        createdServiceSeasonId: career.createdServiceSeasonId,
        rulesetVersion: career.rulesetVersion,
        contentPackVersion: career.contentPackVersion,
      },
      artifacts: loadRetirementArtifacts(career.rulesetVersion, career.contentPackVersion),
    };
    const validated = planCareerArchiveWrite(archive, archive, context).archive;
    const profile = state.player.profile;
    const draft = state.player.draft;
    if (
      !profile ||
      Object.values(draft).some((v) => v === null) ||
      draft.position !== profile.preferredPosition
    )
      throw new Error('Missing initial build');
    const article = CareerArticleSchema.parse({
      id,
      playerName: profile.name,
      initialPosition: profile.preferredPosition,
      seasons: validated.records.totals.seasons,
      playedMatches: validated.records.totals.playedMatches,
      minutes: validated.records.totals.minutes,
      averageRatingTenths: validated.records.totals.averageRatingTenths,
      clubCount: validated.records.clubs.length,
      publishedAt: now,
      highlights: [
        ['GOALS', 'goals'],
        ['ASSISTS', 'assists'],
        ['SAVES', 'saves'],
        ['CLEAN_SHEETS', 'cleanSheet'],
        ['KEY_PASSES', 'keyPasses'],
        ['TACKLES', 'tackles'],
      ].flatMap(([kind, key]) => {
        const values = validated.records.positions
          .map((p) => p.statistics)
          .filter((s) => key! in s);
        return values.length === 0
          ? []
          : [
              {
                kind,
                total: values.reduce((sum, s) => {
                  const value: unknown = Reflect.get(s, key!);
                  return sum + (typeof value === 'number' ? value : 0);
                }, 0),
              },
            ];
      }),
      challenge: {
        seed,
        rulesetVersion: career.rulesetVersion,
        contentPackVersion: career.contentPackVersion,
        simulationMode,
        draft: {
          gender: draft.gender,
          nationalityCode: draft.nationalityCode,
          preferredFoot: draft.preferredFoot,
          position: profile.preferredPosition,
          archetypeId: draft.archetypeId,
          backgroundId: draft.backgroundId,
        },
      },
    });
    // Fail closed for unsupported/malformed initial builds before publishing a non-playable link.
    buildChallengeStart(
      article,
      'publication-validation',
      profile.name,
      career.createdServiceSeasonId,
      now,
    );
    return article;
  } catch {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '공개할 은퇴 기록과 최초 선수 설정을 확인할 수 없습니다.',
    });
  }
}

/** The only special version admission path: server-selected seed/build, no caller snapshot. */
export function buildChallengeStart(
  article: CareerArticle,
  careerId: string,
  name: string,
  serviceSeasonId: string,
  now: string,
) {
  const initial = article.challenge;
  const ruleset = loadRuleset(initial.rulesetVersion);
  const pack = loadContentPack(initial.contentPackVersion);
  if (!pack.manifest.compatibleRulesetVersions.includes(ruleset.version))
    throw new AppError({
      code: 'VERSION_MISMATCH',
      message: '이 도전의 버전을 불러올 수 없습니다.',
    });
  const commands: Command[] = [
    {
      type: 'CREATE_CAREER',
      payload: {
        careerId,
        seed: initial.seed,
        simulationMode: initial.simulationMode,
        rulesetVersion: initial.rulesetVersion,
        contentPackVersion: initial.contentPackVersion,
      },
    },
    { type: 'UPDATE_PLAYER_DRAFT', payload: { draft: { ...initial.draft, name } } },
    { type: 'CONFIRM_PLAYER', payload: {} },
  ];
  let snapshot: DomainSnapshot | null = null;
  const log = commands.map((command, index) => {
    const commandId = `${careerId}:initial:${index + 1}`;
    const result = simulate({
      snapshot,
      command: { ...command, commandId, expectedRevision: index },
      ruleset,
      rulesetVersion: initial.rulesetVersion,
      contentPackVersion: initial.contentPackVersion,
    });
    if (!result.ok) throw new AppError({ code: result.error.code, message: result.error.message });
    snapshot = result.snapshot;
    return {
      careerId,
      revision: snapshot.revision,
      commandId,
      commandType: command.type,
      payload: command.payload,
      resultHash: snapshot.stateHash,
      createdAt: now,
    };
  });
  const final = snapshot as DomainSnapshot | null;
  if (final === null) throw new Error('Missing challenge snapshot');
  return GetCareerResponseSchema.parse({
    createdServiceSeasonId: serviceSeasonId,
    snapshot: {
      ...final,
      id: `${careerId}:${final.revision}`,
      careerId,
      state: canonicalize(final.state as unknown as JsonValue),
      rngState: final.state.rngState,
      createdAt: now,
    },
    commands: log,
  });
}
