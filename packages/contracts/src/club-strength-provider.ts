import { z } from 'zod';
import { ClubStrengthLeagueSchema } from './club-strength.js';
export const SourceSchema = z.object({
  league: ClubStrengthLeagueSchema,
  provider: z.enum(['football-data', 'api-football']),
  competition: z.string().regex(/^[A-Za-z0-9-]{1,12}$/),
  season: z.number().int().min(2020).max(2100).optional(),
  teams: z.record(
    z.string().regex(/^\d+$/),
    z.string().regex(/^(k1|j1|mls|ere|l1|bl|sa|ll|pl)-\d+$/),
  ),
  exclude: z.array(z.string().regex(/^\d+$/)).max(40).default([]),
});
export const SourcesSchema = z
  .array(SourceSchema)
  .max(9)
  .refine((s) => new Set(s.map((x) => x.league)).size === s.length);
export type StrengthSource = z.infer<typeof SourceSchema>;
const integer = z.number().int().nonnegative();
export const fdSchema = z.object({
  season: z.object({ startDate: z.iso.date() }),
  standings: z
    .array(
      z.object({
        type: z.string(),
        table: z
          .array(
            z.object({
              team: z.object({ id: integer }),
              playedGames: integer,
              won: integer,
              draw: integer,
              lost: integer,
              points: z.number().int(),
              goalsFor: integer,
              goalsAgainst: integer,
            }),
          )
          .max(40),
      }),
    )
    .max(8),
});
export const afSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  response: z.array(
    z.object({
      league: z.object({
        season: integer,
        standings: z.array(
          z.array(
            z.object({
              team: z.object({ id: integer }),
              points: z.number().int(),
              all: z.object({
                played: integer,
                win: integer,
                draw: integer,
                lose: integer,
                goals: z.object({ for: integer, against: integer }),
              }),
            }),
          ),
        ),
      }),
    }),
  ),
});
