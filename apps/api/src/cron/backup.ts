// T-10-070 D1 → R2 매일 백업(ADR-007). D1 Time Travel(30일)과 별개로, D1 밖에 오래 남는 사본을 둔다.
// 형식은 `wrangler d1 export`처럼 SQL 텍스트(gzip) — 복구는 풀어서 빈 D1에 그대로 실행한다:
//   gunzip -c 2026-09-28.sql.gz > dump.sql && wrangler d1 execute <새 DB> --remote --file dump.sql
// DB 전체를 메모리에 올리지 않게 표를 rowid 순으로 PAGE씩 읽어 gzip 스트림으로 흘리고, R2에는 멀티파트로 올린다.

/** Candidate row cap. Payloads are additionally bounded in SQL before crossing D1 RPC. */
const PAGE = 2000;
export const BACKUP_PAGE_BYTES = 4 * 1024 * 1024;
/** R2 멀티파트 조각(마지막 조각 말고는 5MiB 이상이어야 한다). */
const PART_BYTES = 8 * 1024 * 1024;
/** 매일 백업은 이만큼 두고, 매달 1일 백업은 계속 둔다. */
const KEEP_DAYS = 30;

export type BackupResult = {
  key: string;
  tables: number;
  rows: number;
  bytes: number;
  pruned: number;
};

type SchemaRow = { type: string; name: string; sql: string };

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

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

/**
 * produce가 write로 흘리는 텍스트를 gzip으로 압축해 R2에 멀티파트로 올리고 올린 바이트 수를 돌려준다. 전체를 메모리에 올리지
 * 않는다. produce가 실패하면 업로드를 버리고 오류를 다시 던진다(반쯤 올린 객체가 남지 않는다).
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

export const backupKey = (env: string, now: number) =>
  `d1/${env}/${new Date(now).toISOString().slice(0, 10)}.sql.gz`;

export async function backupToR2(
  db: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
): Promise<BackupResult> {
  const { results: schema } = await db
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
       ORDER BY rowid`,
    )
    .all<SchemaRow>();
  const tables = byReferences(schema.filter((s) => s.type === 'table'));

  const key = backupKey(env, now);
  let rows = 0;
  const bytes = await gzipToR2(bucket, key, 'application/sql', async (write) => {
    await write(
      `-- offside D1 backup · ${env} · ${new Date(now).toISOString()}\nPRAGMA defer_foreign_keys = true;\n`,
    );
    for (const t of tables) await write(`${t.sql};\n`);
    for (const t of tables) {
      const columns = (await db.prepare(`PRAGMA table_info(${q(t.name)})`).all<{ name: string }>())
        .results;
      const size = columns
        .map((c) => `coalesce(length(CAST(${q(c.name)} AS BLOB)), 0) + 16`)
        .join(' + ');
      let after = 0;
      let candidates = 64;
      for (;;) {
        const page = await db
          .prepare(
            // Only small rowid/size metadata is materialized. Large JSON never forms
            // a 2,000-row RPC response. Always allow one row, even if it exceeds budget.
            `WITH candidates AS MATERIALIZED (
               SELECT rowid AS rid, ${size} AS bytes FROM ${q(t.name)}
               WHERE rowid > ?1 ORDER BY rowid LIMIT ${candidates}
             ), sized AS (
               SELECT rid, sum(bytes) OVER (ORDER BY rid) AS bytes,
                      row_number() OVER (ORDER BY rid) AS n FROM candidates
             )
             SELECT rowid AS __rowid, * FROM ${q(t.name)} WHERE rowid > ?1
             AND rowid <= (SELECT max(rid) FROM sized WHERE bytes <= ?2 OR n = 1)
             ORDER BY rowid`,
          )
          .bind(after, BACKUP_PAGE_BYTES)
          .raw<unknown[]>({ columnNames: true });
        const [cols, ...data] = page as [string[], ...unknown[][]];
        if (!cols || data.length === 0) break;
        const insert = `INSERT INTO ${q(t.name)} (${cols.slice(1).map(q).join(', ')}) VALUES `;
        // Do not retain both an entire SQL page and its encoded copy alongside raw rows.
        for (const r of data) await write(`${insert}(${r.slice(1).map(literal).join(', ')});\n`);
        rows += data.length;
        after = Number(data[data.length - 1]![0]);
        // Avoid repeatedly sizing thousands of wide rows to return just a few.
        candidates = data.length < candidates ? data.length : Math.min(PAGE, candidates * 2);
      }
    }
    // 인덱스·트리거는 데이터를 넣은 뒤에 만든다(넣는 동안 인덱스를 고치지 않게).
    for (const s of schema) if (s.type !== 'table') await write(`${s.sql};\n`);
  });

  return { key, tables: tables.length, rows, bytes, pruned: await prune(bucket, env, now) };
}

/** KEEP_DAYS보다 오래된 매일 백업을 지운다. 매달 1일 백업은 남긴다. */
async function prune(bucket: R2Bucket, env: string, now: number): Promise<number> {
  const cutoff = new Date(now - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prefix = `d1/${env}/`;
  const old: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list(cursor ? { prefix, cursor } : { prefix });
    for (const o of page.objects) {
      const day = o.key.slice(prefix.length, prefix.length + 10);
      if (day < cutoff && !day.endsWith('-01')) old.push(o.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (old.length) await bucket.delete(old);
  return old.length;
}
