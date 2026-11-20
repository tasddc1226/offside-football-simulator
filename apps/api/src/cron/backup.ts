import { BACKUP_CONTROL_KEY, BACKUP_LEASE_KEY as LEASE_KEY } from './backupControl.js';
// T-10-070 D1 → R2 매일 백업(ADR-007). D1 Time Travel(30일)과 별개로, D1 밖에 오래 남는 사본을 둔다.
// 형식은 `wrangler d1 export`처럼 SQL 텍스트를 gzip한 조각이다(복구: docs/operations/d1-backup.md).
// DB 전체를 메모리에 올리지 않게 표를 rowid 순으로 PAGE씩 읽어 gzip 스트림으로 흘린다.
//
// T-11-274 한 호출에 다 만들지 않고 조각으로 나눠 이어받는다. 2026-10-14 DB가 4.3GB가 되자 백업 한 번이 scheduled
// 핸들러의 15분 벽시계 상한을 넘겨 중간에 죽었고, 뒤에 오던 성장 기록 이관·휴면 보존도 함께 건너뛰어졌다. 지금은
// 5분 cron이 매 틱 한 단계(BACKUP_STEP_MS 안에서 읽은 만큼)를 `d1/<env>/<day>/0001.sql.gz, 0002…` 객체 하나로 올리고
// 다음 위치(표·rowid)를 app_meta에 적는다. 조각마다 완전한 gzip이라 번호 순서로 이어 실행하면 한 파일과 같다.
//
// T-11-777 마감(seal). 복사가 여러 시간 걸려, 먼저 복사한 표(부모)에 그 뒤 생긴 행이 빠진 채 나중 표(자식)가 그 행을
// 가리켰다(2026-11-02 복원에서 외래 키 1,711건 실패). 표마다 복사를 마친 rowid를 기억해 두고, 전체 복사 뒤 그보다 큰
// rowid만 다시 읽어 붙인다. 남은 행이 적어지면 마지막 한 번은 `db.batch()`(한 트랜잭션)로 모든 표를 같은 시점에 읽는다.
// 마감 행은 `INSERT OR REPLACE`로 쓴다 — 앱이 행을 지우고 다시 넣었으면 같은 키의 옛 행이 앞 조각에 있다.
// 제자리에서 고친 값(UPDATE)은 복사한 때의 값 그대로다. 한 시점 사본이 아니라 외래 키가 맞는 사본이다.
// 작은 표(SEAL_SMALL_ROWS 이하)는 마지막 읽기에서 통째로 다시 써서 고친 값과 다시 쓰인 rowid까지 맞춘다. 큰 표에서
// 끝 행이 지워진 직후 그 rowid로 들어온 새 행은 놓칠 수 있다 — 주간 복원 검증의 외래 키 검사가 잡는다.

/** Candidate row cap. Payloads are additionally bounded in SQL before crossing D1 RPC. */
const PAGE = 2000;
export const BACKUP_PAGE_BYTES = 4 * 1024 * 1024;
/** Yield the primary between pages, without adding seconds to every table. */
export const BACKUP_PAGE_PAUSE_MS = 20;
/** 한 단계가 쥐는 잠금. 호출이 죽어도 다음 5분 틱이 이어받을 수 있게 짧고, 정상 단계(≤ BACKUP_STEP_MS + 업로드)보다는 길다. */
const LEASE_MS = 4 * 60_000;
/** 진행 중인 백업의 위치(표·rowid·조각 번호). 끝나면 지우고 BACKUP_LAST_KEY에 결과를 남긴다. */
export const BACKUP_STATE_KEY = 'cron:backup:state';
export const BACKUP_LAST_KEY = 'cron:backup:last';
/** 한 단계가 D1을 읽는 벽시계 예산. 5분 cron의 다른 단계와 함께 15분 상한 안에 넉넉히 든다. */
export const BACKUP_STEP_MS = 45_000;
/** 한 조각의 압축 바이트 상한 — 메모리에 모아 put 한 번으로 올린다(워커 128MiB). */
export const BACKUP_CHUNK_BYTES = 24 * 1024 * 1024;
/** 매일 백업은 이만큼 두고, 매달 1일 백업은 계속 둔다. */
const KEEP_DAYS = 30;
/** 백업 하루의 경계 — UTC 19:00(KST 04:00). 그 뒤 첫 5분 cron이 그날 백업을 시작한다. */
const DAY_START_MS = 19 * 60 * 60_000;
/** 마감 한 바퀴에서 새로 읽은 행이 이보다 적으면 더 돌지 않고 마지막 트랜잭션 읽기로 넘어간다. */
export const SEAL_SETTLED_ROWS = 200;
/** 마감을 도는 최대 바퀴 수. 쓰기가 계속 몰려도 백업이 끝나지 않는 일은 없게 한다. */
export const SEAL_MAX_PASSES = 4;
/** 마지막 트랜잭션 읽기에서 표 하나가 내놓을 수 있는 행 수. 넘치면 한 바퀴 더 돈다. */
export const SEAL_FINAL_ROWS = 50;
/** 복사 때 행이 이 수 이하였던 표는 마지막 트랜잭션에서 통째로 다시 읽는다. rowid는 끝 행이 지워지면 다시 쓰여서
 * (잠금 행을 매 틱 지우고 넣는 app_meta), "기억해 둔 rowid보다 큰 행"만으로는 새 행을 놓칠 수 있다. */
export const SEAL_SMALL_ROWS = 200;
/** 검증 도구(tooling/scripts/verify-live-copy.mjs)가 읽는 목록. 조각 접두사(d1/…)와 따로 둔다. */
export const manifestKey = (env: string, day: string) => `d1-manifests/${env}/${day}.json`;
export const latestManifestKey = (env: string) => `d1-manifests/${env}/latest.json`;
export const LIVE_COPY_FORMAT = 'offside-d1-live-copy-v1';

export type BackupResult = {
  /** Multi-tick secondary copy, never a point-in-time snapshot. `sealed`: 마감까지 끝나 외래 키가 맞는 사본. */
  consistency: 'live-copy' | 'sealed';
  restoreVerified: false;
  /** 마감에서 돈 바퀴 수와 덧붙인 행 수. 배포 전에 시작한 백업에는 없다. */
  seal?: { passes: number; rows: number };
  /** 조각 객체들의 접두사 `d1/<env>/<day>/`. */
  key: string;
  day: string;
  tables: number;
  rows: number;
  bytes: number;
  pruned: number;
  pages: number;
  pauseMs: number;
  chunks: number;
  steps: number;
  startedAt: number;
  finishedAt: number;
};

/** 진행 중인 백업. `table`은 `tables`의 인덱스, `after`는 그 표에서 마지막으로 내보낸 rowid. */
export type BackupState = {
  day: string;
  key: string;
  tables: string[];
  table: number;
  after: number;
  chunk: number;
  rows: number;
  pages: number;
  bytes: number;
  steps: number;
  startedAt: number;
  /** 표마다 지금까지 내보낸 마지막 rowid. 없으면(T-11-777 전에 시작한 백업) 마감을 건너뛴다. */
  hwm?: Record<string, number>;
  /** 표마다 복사 단계에서 내보낸 행 수(작은 표를 고르는 데 쓴다). */
  counts?: Record<string, number>;
  phase?: 'copy' | 'seal';
  /** 마감 바퀴 번호(1부터)와 이번 바퀴에서 읽은 행 수, 마감 전체에서 덧붙인 행 수. */
  pass?: number;
  passRows?: number;
  sealRows?: number;
  sealed?: boolean;
  /** 고유 인덱스를 마감 행 앞에 이미 썼다(끝에서 다시 쓰지 않는다). */
  uniq?: boolean;
  /** 마감 단계에서 이어진 D1 오류 횟수. */
  sealFails?: number;
  /** 올린 조각의 크기와 SHA-256(번호 순). */
  objects?: { bytes: number; sha256: string }[];
};

export type BackupStepResult = {
  day: string;
  chunk: number;
  rows: number;
  bytes: number;
  done: boolean;
};

type SchemaRow = { type: string; name: string; sql: string };

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** 열 수만큼 `a + b + …`로 이으면 SQLite 식 깊이 상한(100)을 넘는다(careers 47열). 반씩 묶어 깊이를 log로 둔다. */
function balancedSum(terms: string[]): string {
  if (terms.length <= 2) return terms.join(' + ') || '0';
  const mid = terms.length >> 1;
  return `(${balancedSum(terms.slice(0, mid))}) + (${balancedSum(terms.slice(mid))})`;
}

/** SQLite 리터럴. D1은 값을 null·number·string, BLOB은 바이트 배열로 돌려준다. */
function literal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v))
    return `X'${v.map((b: number) => b.toString(16).padStart(2, '0')).join('')}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** 참조되는 표의 행을 먼저 넣는다(외래 키). 마이그레이션이 표를 다시 만들면 만든 순서가 참조 순서와 달라진다.
 * 머리글의 defer_foreign_keys는 파일을 한 트랜잭션으로 실행할 때만 듣는다 — 문장마다 실행해도 되게 순서도 맞춘다. */
function byReferences(tables: SchemaRow[]): SchemaRow[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const out: SchemaRow[] = [];
  const seen = new Set<string>();
  const visit = (t: SchemaRow) => {
    if (seen.has(t.name)) return;
    seen.add(t.name);
    for (const [, ref] of t.sql.matchAll(/REFERENCES\s+[`"']?(\w+)/gi)) {
      const dep = byName.get(ref!);
      if (dep) visit(dep);
    }
    out.push(t);
  };
  tables.forEach(visit);
  return out;
}

/** 스트림을 정확히 size 바이트씩 잘라 내준다(마지막 조각만 작을 수 있다).
 * T-11-088 R2는 마지막 말고는 조각 크기가 모두 같아야 한다 — 넘친 만큼 통째로 올리면 complete에서 거부된다. */
export async function* fixedParts(stream: ReadableStream<Uint8Array>, size: number) {
  // 덩어리는 배열에 모으고 조각마다 Blob을 한 번만 만든다(읽을 때마다 합치면 조각 크기만큼 매번 복사한다).
  const reader = stream.getReader();
  let buf: Uint8Array[] = [];
  let len = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let rest = value;
      while (len + rest.byteLength >= size) {
        const take = size - len;
        buf.push(rest.subarray(0, take));
        yield new Blob(buf);
        rest = rest.subarray(take);
        buf = [];
        len = 0;
      }
      if (rest.byteLength) {
        buf.push(rest);
        len += rest.byteLength;
      }
    }
    if (len > 0) yield new Blob(buf);
  } finally {
    // A failed R2 part must cancel the reader, otherwise the SQL producer can
    // block forever on gzip backpressure and never reach multipart abort.
    await reader.cancel(new Error('gzip upload reader closed')).catch(() => {});
    reader.releaseLock();
  }
}

/** R2 멀티파트 조각(마지막 조각 말고는 5MiB 이상이어야 한다). */
const PART_BYTES = 8 * 1024 * 1024;

/**
 * produce가 write로 흘리는 텍스트를 gzip으로 압축해 R2에 멀티파트로 올리고 올린 바이트 수를 돌려준다. 전체를 메모리에 올리지
 * 않는다. produce가 실패하면 업로드를 버리고 오류를 다시 던진다(반쯤 올린 객체가 남지 않는다).
 * 성장 기록·시즌 측정 보관처럼 한 호출에 끝나는 보관이 쓴다. 백업은 조각마다 gzipChunk로 모아 put 한다.
 */
export async function gzipToR2(
  bucket: R2Bucket,
  key: string,
  contentType: string,
  produce: (write: (s: string) => Promise<void>) => Promise<void>,
): Promise<number> {
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType, contentEncoding: 'gzip' },
  });
  const gzip = new CompressionStream('gzip');
  const writer = gzip.writable.getWriter();
  const encoder = new TextEncoder();

  // 압축된 바이트를 PART_BYTES씩 조각으로 올린다(쓰기와 동시에 돈다).
  const parts: R2UploadedPart[] = [];
  let bytes = 0;
  let uploadError: unknown;
  const uploading = (async () => {
    for await (const part of fixedParts(gzip.readable, PART_BYTES)) {
      try {
        parts.push(await upload.uploadPart(parts.length + 1, part));
      } catch (e) {
        uploadError = e;
        throw e;
      }
      bytes += part.size;
    }
  })();
  // Observe rejection immediately while produce may still be writing.
  void uploading.catch(() => {});

  try {
    await produce((s) => writer.write(encoder.encode(s)));
    await writer.close();
    await uploading;
    await upload.complete(parts);
  } catch (e) {
    await writer.abort(e).catch(() => {});
    await uploading.catch(() => {});
    await upload.abort().catch(() => {});
    throw uploadError ?? e;
  }
  return bytes;
}

/**
 * produce가 흘리는 텍스트를 gzip으로 메모리에 모은다. produce는 `compressed()`로 지금까지 압축된 바이트(압축 스트림이
 * 아직 안 내보낸 꼬리는 빼고)를 보고 멈출 때를 정한다. 돌려주는 Blob은 완전한 gzip 한 개다.
 */
async function gzipChunk(
  produce: (write: (s: string) => Promise<void>, compressed: () => number) => Promise<void>,
): Promise<Blob> {
  const gzip = new CompressionStream('gzip');
  const writer = gzip.writable.getWriter();
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  // 압축 결과는 쓰기와 동시에 받아 둬야 backpressure로 writer가 멈추지 않는다.
  const collecting = (async () => {
    const reader = gzip.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      bytes += value.byteLength;
    }
  })();
  try {
    await produce(
      (s) => writer.write(encoder.encode(s)),
      () => bytes,
    );
    await writer.close();
  } catch (e) {
    await writer.abort(e).catch(() => {});
    await collecting.catch(() => {});
    throw e;
  }
  await collecting;
  return new Blob(parts);
}

/** 백업이 속하는 날 — UTC 19:00(KST 04:00)에 하루가 시작한다. 그 전은 전날 백업이다. */
export const backupDay = (now: number) => new Date(now - DAY_START_MS).toISOString().slice(0, 10);
/** 그날 조각들의 접두사. 조각은 `<접두사>0001.sql.gz`부터 번호 순이다. */
export const backupKey = (env: string, now: number) => `d1/${env}/${backupDay(now)}/`;
export const chunkKey = (prefix: string, chunk: number) =>
  `${prefix}${String(chunk).padStart(4, '0')}.sql.gz`;

async function loadSchema(db: D1Database): Promise<SchemaRow[]> {
  const { results } = await db
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
       ORDER BY rowid`,
    )
    .all<SchemaRow>();
  return results;
}

async function newState(db: D1Database, env: string, now: number): Promise<BackupState> {
  const schema = await loadSchema(db);
  return {
    day: backupDay(now),
    key: backupKey(env, now),
    tables: byReferences(schema.filter((s) => s.type === 'table')).map((t) => t.name),
    table: 0,
    after: 0,
    chunk: 0,
    rows: 0,
    pages: 0,
    bytes: 0,
    steps: 0,
    startedAt: Date.now(),
    hwm: {},
    counts: {},
    phase: 'copy',
    objects: [],
  };
}

/** rowid가 after보다 큰 행을 바이트 예산 안에서 한 쪽 읽는다. 첫 줄은 열 이름(`__rowid` 먼저). */
async function readPage(
  db: D1Database,
  name: string,
  size: string,
  after: number,
  candidates: number,
): Promise<{ cols: string[]; data: unknown[][] }> {
  const page = await db
    .prepare(
      // Only small rowid/size metadata is materialized. Large JSON never forms
      // a 2,000-row RPC response. Always allow one row, even if it exceeds budget.
      `WITH candidates AS MATERIALIZED (
         SELECT rowid AS rid, ${size} AS bytes FROM ${q(name)}
         WHERE rowid > ?1 ORDER BY rowid LIMIT ${candidates}
       ), sized AS (
         SELECT rid, sum(bytes) OVER (ORDER BY rid) AS bytes,
                row_number() OVER (ORDER BY rid) AS n FROM candidates
       )
       SELECT rowid AS __rowid, * FROM ${q(name)} WHERE rowid > ?1
       AND rowid <= (SELECT max(rid) FROM sized WHERE bytes <= ?2 OR n = 1)
       ORDER BY rowid`,
    )
    .bind(after, BACKUP_PAGE_BYTES)
    .raw<unknown[]>({ columnNames: true });
  const [cols, ...data] = page as [string[], ...unknown[][]];
  return { cols: cols ?? [], data };
}

async function sizeExpr(db: D1Database, name: string): Promise<string> {
  const columns = (await db.prepare(`PRAGMA table_info(${q(name)})`).all<{ name: string }>())
    .results;
  // SQLite reads TEXT/BLOB byte lengths from record metadata. Casting first
  // loads wide JSON overflow pages just to size rows we may not export yet.
  return balancedSum(columns.map((c) => `(coalesce(octet_length(${q(c.name)}), 0) + 16)`));
}

const sha256Hex = async (blob: Blob) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

const isUniqueIndex = (s: SchemaRow) =>
  s.type === 'index' && /^\s*CREATE\s+UNIQUE\s+INDEX/i.test(s.sql);

/**
 * 조건이 붙은 고유 인덱스(`... ON 표 (열, …) WHERE …`)의 열 목록을 표별로 모은다. 식 인덱스는 뺀다.
 * 조건을 벗어난 옛 행(예: 닫힌 매물)과 같은 키의 새 행(다시 올린 매물)이 함께 있을 수 있는 인덱스다.
 */
export function partialUniqueKeys(schema: SchemaRow[]): Map<string, string[][]> {
  const out = new Map<string, string[][]>();
  for (const s of schema) {
    if (!isUniqueIndex(s)) continue;
    const m = /\sON\s+[`"[]?(\w+)[`"\]]?\s*\(([^()]*)\)\s*WHERE\s/i.exec(s.sql);
    if (!m) continue;
    const cols = m[2]!.split(',').map((c) =>
      c
        .trim()
        .replace(/\s+(ASC|DESC)$/i, '')
        .replace(/^[`"[]|[`"\]]$/g, ''),
    );
    if (!cols.length || cols.length > 4 || !cols.every((c) => /^\w+$/.test(c))) continue;
    out.set(m[1]!, [...(out.get(m[1]!) ?? []), cols]);
  }
  return out;
}

/** 마감 단계에서 D1 오류가 이만큼 이어지면 마감을 포기하고 live-copy로 끝낸다(백업 자체는 남긴다). */
export const SEAL_MAX_FAILS = 3;
const REFETCH_PARAMS = 60;
const REFETCH_ROWS = 400;

type StepOptions = {
  /** D1 읽기를 멈추는 벽시계 예산(ms). 기본 BACKUP_STEP_MS. */
  stepMs?: number;
  /** 조각 압축 바이트 상한. 기본 BACKUP_CHUNK_BYTES. */
  chunkBytes?: number;
};

/**
 * 조각 하나를 만들어 올리고 상태를 전진시킨다. 첫 조각은 머리글과 CREATE TABLE, 마지막 조각은 인덱스·트리거까지 쓴다.
 * 조각 경계는 항상 행 경계라 각 조각은 그 자체로 실행 가능한 SQL이다. 상태는 올린 뒤에만 바꾸므로, 중간에 죽으면
 * 다음 단계가 같은 번호의 조각을 다시 만들어 같은 키에 덮어쓴다.
 */
async function exportStep(
  db: D1Database,
  bucket: R2Bucket,
  state: BackupState,
  opts: StepOptions,
): Promise<{ state: BackupState; done: boolean }> {
  const stepMs = opts.stepMs ?? BACKUP_STEP_MS;
  const chunkBytes = opts.chunkBytes ?? BACKUP_CHUNK_BYTES;
  const deadline = Date.now() + stepMs;
  const schema = await loadSchema(db);
  const tableSql = new Map(schema.filter((s) => s.type === 'table').map((t) => [t.name, t.sql]));
  const next: BackupState = { ...state };
  let done = false;
  const blob = await gzipChunk(async (write, compressed) => {
    if (next.chunk === 0) {
      await write(
        `-- offside D1 backup · ${next.key} · ${new Date(next.startedAt).toISOString()}\nPRAGMA defer_foreign_keys = true;\n`,
      );
      for (const name of next.tables) {
        const sql = tableSql.get(name);
        if (sql) await write(`${sql};\n`);
      }
    }
    const sealable = (name: string) => tableSql.has(name) && next.hwm?.[name] !== undefined;
    const partial = partialUniqueKeys(schema);
    /**
     * 마감 행과 조건부 고유 키가 같은 행을 지금 값으로 다시 내보낸다. 마감 행이 들어가며 밀어낸 옛 사본(복사한 뒤
     * 제자리에서 조건을 벗어난 행)이 지금 값으로 되돌아온다. 마감 행 뒤에 써야 한다.
     */
    const refetch = async (name: string, cols: string[], rows: unknown[][]): Promise<number> => {
      let written = 0;
      for (const key of partial.get(name) ?? []) {
        const at = key.map((c) => cols.indexOf(c));
        if (at.some((i) => i < 0)) continue;
        const seen = new Set<string>();
        const tuples: (string | number)[][] = [];
        for (const r of rows) {
          const tuple = at.map((i) => r[i]);
          if (!tuple.every((v) => typeof v === 'string' || typeof v === 'number')) continue;
          const id = JSON.stringify(tuple);
          if (seen.has(id)) continue;
          seen.add(id);
          tuples.push(tuple as (string | number)[]);
        }
        const per = Math.max(1, Math.floor(REFETCH_PARAMS / key.length));
        for (let i = 0; i < tuples.length; i += per) {
          const part = tuples.slice(i, i + per);
          const where = part.map(() => `(${key.map((c) => `${q(c)} = ?`).join(' AND ')})`);
          const page = await db
            .prepare(
              `SELECT * FROM ${q(name)} WHERE ${where.join(' OR ')} ORDER BY rowid LIMIT ${REFETCH_ROWS}`,
            )
            .bind(...part.flat())
            .raw<unknown[]>({ columnNames: true });
          const [names, ...data] = page as [string[], ...unknown[][]];
          if (!data.length) continue;
          const insert = `INSERT OR REPLACE INTO ${q(name)} (${names.map(q).join(', ')}) VALUES `;
          for (const r of data) await write(`${insert}(${r.map(literal).join(', ')});\n`);
          written += data.length;
        }
      }
      next.rows += written;
      next.sealRows = (next.sealRows ?? 0) + written;
      return written;
    };
    for (; next.phase !== 'seal' && next.table < next.tables.length; next.table++, next.after = 0) {
      const name = next.tables[next.table]!;
      // 백업이 도는 사이 마이그레이션으로 사라진 표는 건너뛴다(만든 문장도 첫 조각 때 기준이다).
      if (!tableSql.has(name)) continue;
      const size = await sizeExpr(db, name);
      let candidates = 64;
      for (;;) {
        const { cols, data } = await readPage(db, name, size, next.after, candidates);
        if (data.length === 0) break;
        next.pages++;
        const insert = `INSERT INTO ${q(name)} (${cols.slice(1).map(q).join(', ')}) VALUES `;
        // Do not retain both an entire SQL page and its encoded copy alongside raw rows.
        for (const r of data) await write(`${insert}(${r.slice(1).map(literal).join(', ')});\n`);
        next.rows += data.length;
        next.after = Number(data[data.length - 1]![0]);
        if (next.hwm) next.hwm[name] = next.after;
        if (next.counts) next.counts[name] = (next.counts[name] ?? 0) + data.length;
        // Avoid repeatedly sizing thousands of wide rows to return just a few.
        candidates = data.length < candidates ? data.length : Math.min(PAGE, candidates * 2);
        // Backpressure from gzip/R2 does not guarantee a break between D1 reads.
        await new Promise<void>((resolve) => setTimeout(resolve, BACKUP_PAGE_PAUSE_MS));
        // 예산을 다 썼으면 이 표의 이 위치에서 조각을 닫는다. 다음 단계가 after 다음 행부터 잇는다.
        if (Date.now() >= deadline || compressed() >= chunkBytes) return;
      }
      if (next.hwm) next.hwm[name] ??= 0;
    }
    if (next.hwm && next.phase !== 'seal') {
      next.phase = 'seal';
      next.pass = 1;
      next.passRows = 0;
      next.sealRows = 0;
      next.table = 0;
      next.after = 0;
      // 고유 인덱스는 마감 행보다 먼저 만든다. 그래야 INSERT OR REPLACE가 같은 고유 키의 옛 사본을 밀어낸다
      // (인덱스가 없으면 둘 다 남아 끝의 CREATE UNIQUE INDEX에서 복원이 멈춘다).
      for (const s of schema) if (isUniqueIndex(s)) await write(`${s.sql};\n`);
      next.uniq = true;
    }
    // 마감: 복사하는 동안 새로 생긴 행(rowid > 기억해 둔 값)만 다시 읽는다. 표 순서는 복사 때와 같아(참조되는 표 먼저)
    // 부모를 바꿔 넣을 때 딸려 지워지는 자식(cascade)은 그 뒤에 다시 들어온다.
    try {
      while (next.phase === 'seal' && next.hwm && next.sealed === undefined) {
        const hwm = next.hwm;
        const names = next.tables.filter(sealable);
        // 새 행이 있는 표만 고른다. max(rowid)는 B-tree 끝만 읽는다.
        const tops = names.length
          ? await db.batch<{ m: number | null }>(
              names.map((n) => db.prepare(`SELECT max(rowid) AS m FROM ${q(n)}`)),
            )
          : [];
        const dirty = new Set(names.filter((n, i) => (tops[i]!.results[0]?.m ?? 0) > hwm[n]!));
        for (; next.table < next.tables.length; next.table++) {
          const name = next.tables[next.table]!;
          if (!dirty.has(name)) continue;
          const size = await sizeExpr(db, name);
          let candidates = 64;
          for (;;) {
            const { cols, data } = await readPage(db, name, size, hwm[name]!, candidates);
            if (data.length === 0) break;
            next.pages++;
            const insert = `INSERT OR REPLACE INTO ${q(name)} (${cols.slice(1).map(q).join(', ')}) VALUES `;
            for (const r of data)
              await write(`${insert}(${r.slice(1).map(literal).join(', ')});\n`);
            next.rows += data.length;
            next.passRows! += data.length;
            next.sealRows! += data.length;
            hwm[name] = Number(data[data.length - 1]![0]);
            await refetch(
              name,
              cols.slice(1),
              data.map((r) => r.slice(1)),
            );
            candidates = data.length < candidates ? data.length : Math.min(PAGE, candidates * 2);
            await new Promise<void>((resolve) => setTimeout(resolve, BACKUP_PAGE_PAUSE_MS));
            if (Date.now() >= deadline || compressed() >= chunkBytes) return;
          }
        }
        const again = () => {
          next.pass!++;
          next.passRows = 0;
          next.table = 0;
        };
        if (next.passRows! > SEAL_SETTLED_ROWS && next.pass! < SEAL_MAX_PASSES) {
          again();
          if (Date.now() >= deadline) return;
          continue;
        }
        // 마지막: 한 트랜잭션(batch)으로 모든 표의 남은 새 행을 같은 시점에 읽는다. 작은 표는 통째로 읽는다.
        const small = (n: string) => (next.counts?.[n] ?? Infinity) <= SEAL_SMALL_ROWS;
        const cap = (n: string) => (small(n) ? SEAL_SMALL_ROWS * 2 : SEAL_FINAL_ROWS);
        const tail = names.length
          ? await db.batch<Record<string, unknown>>(
              names.map((n) =>
                db
                  .prepare(
                    `SELECT rowid AS __rowid, * FROM ${q(n)} WHERE rowid > ?1 ORDER BY rowid LIMIT ${cap(n) + 1}`,
                  )
                  .bind(small(n) ? 0 : hwm[n]!),
              ),
            )
          : [];
        // 복사 때 작던 표가 그 사이 커졌으면 통째로 읽지 않는다. 큰 표로 바꿔(새 행만) 한 번 더 돈다 — 바퀴 수는 쓰지 않는다.
        const grown = names.filter((n, i) => small(n) && tail[i]!.results.length > cap(n));
        if (grown.length && next.counts) {
          for (const n of grown) delete next.counts[n];
          next.passRows = 0;
          next.table = 0;
          if (Date.now() >= deadline) return;
          continue;
        }
        const overflow = names.some((n, i) => tail[i]!.results.length > cap(n));
        if (overflow && next.pass! < SEAL_MAX_PASSES) {
          again();
          if (Date.now() >= deadline) return;
          continue;
        }
        if (!overflow) {
          for (const [i, name] of names.entries()) {
            const rows = tail[i]!.results;
            if (!rows.length) continue;
            const cols = Object.keys(rows[0]!).filter((c) => c !== '__rowid');
            const insert = `INSERT OR REPLACE INTO ${q(name)} (${cols.map(q).join(', ')}) VALUES `;
            for (const r of rows)
              await write(`${insert}(${cols.map((c) => literal(r[c])).join(', ')});\n`);
            next.rows += rows.length;
            next.sealRows! += rows.length;
            hwm[name] = Math.max(hwm[name]!, Number(rows[rows.length - 1]!.__rowid));
            await refetch(
              name,
              cols,
              rows.map((r) => cols.map((c) => r[c])),
            );
          }
        }
        next.sealed = !overflow;
        break;
      }
    } catch (e) {
      // 마감 중 D1 오류. 지금까지 쓴 줄은 온전하니 조각을 닫고 다음 틱에 잇는다. 계속 실패하면 마감을 포기한다 —
      // 마감 때문에 그날 백업이 통째로 없어지면 안 된다.
      next.sealFails = (next.sealFails ?? 0) + 1;
      console.warn(
        JSON.stringify({
          event: 'backup_seal_failed',
          fails: next.sealFails,
          error: String(e).slice(0, 200),
        }),
      );
      if (next.sealFails < SEAL_MAX_FAILS) return;
      next.sealed = false;
    }
    // 인덱스·트리거는 데이터를 넣은 뒤에 만든다(넣는 동안 인덱스를 고치지 않게).
    for (const s of schema)
      if (s.type !== 'table' && !(next.uniq && isUniqueIndex(s))) await write(`${s.sql};\n`);
    done = true;
  });
  next.chunk++;
  next.steps++;
  next.bytes += blob.size;
  if (next.objects) next.objects.push({ bytes: blob.size, sha256: await sha256Hex(blob) });
  await bucket.put(chunkKey(next.key, next.chunk), blob, {
    // Content-Encoding을 붙이지 않는다 — 붙이면 받는 쪽(REST · wrangler)이 풀어서 줘서 저장한 바이트의 해시를
    // 다시 확인할 수 없다(T-11-777, 일관 스냅샷 조각과 같은 규칙). 받은 파일은 gzip 그대로다.
    httpMetadata: { contentType: 'application/gzip' },
  });
  return { state: next, done };
}

const finished = async (
  bucket: R2Bucket,
  env: string,
  state: BackupState,
  now: number,
): Promise<BackupResult> => ({
  key: state.key,
  consistency: state.sealed ? 'sealed' : 'live-copy',
  restoreVerified: false,
  ...(state.phase === 'seal'
    ? { seal: { passes: state.pass ?? 0, rows: state.sealRows ?? 0 } }
    : {}),
  day: state.day,
  tables: state.tables.length,
  rows: state.rows,
  bytes: state.bytes,
  pruned: await prune(bucket, env, now),
  pages: state.pages,
  pauseMs: state.pages * BACKUP_PAGE_PAUSE_MS,
  chunks: state.chunk,
  steps: state.steps,
  startedAt: state.startedAt,
  finishedAt: Date.now(),
});

/** 조각 목록(크기·해시)을 R2에 남긴다. 주간 복원 검증이 D1을 읽지 않고 이 파일만으로 조각을 받아 확인한다. */
async function publishManifest(
  bucket: R2Bucket,
  env: string,
  state: BackupState,
  result: BackupResult,
): Promise<void> {
  if (!state.objects || state.objects.length !== state.chunk) return;
  const content = JSON.stringify({
    format: LIVE_COPY_FORMAT,
    env,
    day: result.day,
    prefix: result.key,
    consistency: result.consistency,
    seal: result.seal ?? null,
    tables: result.tables,
    rows: result.rows,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    chunks: state.objects.map((o, i) => ({
      object: `${String(i + 1).padStart(4, '0')}.sql.gz`,
      ...o,
    })),
  });
  const meta = { httpMetadata: { contentType: 'application/json' } };
  await bucket.put(manifestKey(env, result.day), content, meta);
  await bucket.put(latestManifestKey(env), content, meta);
}

/** 같은 DB의 백업 단계가 겹치지 않게 app_meta 잠금을 선점한다. 만료된 잠금(죽은 호출)은 넘겨받는다. */
async function claimLease(db: D1Database): Promise<string | null> {
  const wall = Date.now();
  const lease = JSON.stringify({ token: crypto.randomUUID(), expiresAt: wall + LEASE_MS });
  const claimed = await db
    .prepare(
      `INSERT INTO app_meta(key,value) SELECT ?1,?2 WHERE NOT EXISTS (
         SELECT 1 FROM app_meta WHERE key=?4 AND json_extract(value,'$.pausedUntil') > ?3
       ) ON CONFLICT(key) DO UPDATE SET value=excluded.value
       WHERE CAST(json_extract(app_meta.value,'$.expiresAt') AS INTEGER) <= ?3 RETURNING value`,
    )
    .bind(LEASE_KEY, lease, wall, BACKUP_CONTROL_KEY)
    .first();
  return claimed ? lease : null;
}
// A stale owner must never release a replacement owner's lease.
const releaseLease = (db: D1Database, lease: string) =>
  db.prepare('DELETE FROM app_meta WHERE key=?1 AND value=?2').bind(LEASE_KEY, lease).run();

async function readMeta<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db
    .prepare('SELECT value FROM app_meta WHERE key=?1')
    .bind(key)
    .first<{ value: string }>();
  return row ? (JSON.parse(row.value) as T) : null;
}
const upsertMeta = (db: D1Database, key: string, value: unknown) =>
  db
    .prepare(
      'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .bind(key, JSON.stringify(value));

/**
 * 5분 cron이 매 틱 부른다. 진행 중인 백업이 있으면 한 조각 더 올리고, 없으면 오늘(UTC 19:00 기준) 백업이 아직 없을 때
 * 새로 시작한다. 할 일이 없거나 다른 호출이 잠금을 쥐고 있으면 null.
 */
export async function runBackupStep(
  db: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
  opts: StepOptions = {},
): Promise<BackupStepResult | null> {
  const day = backupDay(now);
  let state = await readMeta<BackupState>(db, BACKUP_STATE_KEY);
  if (!state) {
    const last = await readMeta<BackupResult>(db, BACKUP_LAST_KEY);
    if (last?.day === day) return null;
  }
  const lease = await claimLease(db);
  if (!lease) return null;
  try {
    // 잠금 안에서 다시 읽는다 — 앞선 호출이 그 사이 상태를 바꿨을 수 있다.
    state = (await readMeta<BackupState>(db, BACKUP_STATE_KEY)) ?? (await newState(db, env, now));
    const { state: next, done } = await exportStep(db, bucket, state, opts);
    if (done) {
      const result = await finished(bucket, env, next, now);
      await publishManifest(bucket, env, next, result);
      await db.batch([
        upsertMeta(db, BACKUP_LAST_KEY, result),
        db.prepare('DELETE FROM app_meta WHERE key=?1').bind(BACKUP_STATE_KEY),
      ]);
    } else await upsertMeta(db, BACKUP_STATE_KEY, next).run();
    return { day: next.day, chunk: next.chunk, rows: next.rows, bytes: next.bytes, done };
  } finally {
    await releaseLease(db, lease);
  }
}

/**
 * 한 호출에 끝까지 백업한다(로컬 확인·테스트). 운영은 runBackupStep으로 조각을 나눠 올린다.
 * 진행 중인 상태가 남아 있어도 무시하고 지금 시각의 백업을 처음부터 만든다.
 */
export async function backupToR2(
  db: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
  opts: StepOptions = {},
): Promise<BackupResult> {
  const lease = await claimLease(db);
  if (!lease) throw new Error('D1 backup already running');
  try {
    let state = await newState(db, env, now);
    for (;;) {
      const step = await exportStep(db, bucket, state, { stepMs: Infinity, ...opts });
      state = step.state;
      if (step.done) break;
    }
    const result = await finished(bucket, env, state, now);
    await publishManifest(bucket, env, state, result);
    await upsertMeta(db, BACKUP_LAST_KEY, result).run();
    return result;
  } finally {
    await releaseLease(db, lease);
  }
}

/** KEEP_DAYS보다 오래된 매일 백업을 지운다(한 파일이던 옛 키와 조각 접두사 모두). 매달 1일 백업은 남긴다. */
async function prune(bucket: R2Bucket, env: string, now: number): Promise<number> {
  const cutoff = new Date(now - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const old: string[] = [];
  // 조각(d1/…)과 그 목록(d1-manifests/…)을 같은 기준으로 지운다. 날짜로 시작하지 않는 키(latest.json)는 둔다.
  for (const prefix of [`d1/${env}/`, `d1-manifests/${env}/`]) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list(cursor ? { prefix, cursor } : { prefix });
      for (const o of page.objects) {
        const day = o.key.slice(prefix.length, prefix.length + 10);
        if (/^\d{4}-\d\d-\d\d$/.test(day) && day < cutoff && !day.endsWith('-01')) old.push(o.key);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  if (old.length) await bucket.delete(old);
  return old.length;
}
