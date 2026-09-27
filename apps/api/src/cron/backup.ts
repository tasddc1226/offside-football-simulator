// T-10-070 D1 → R2 매일 백업(ADR-007). D1 Time Travel(30일)과 별개로, D1 밖에 오래 남는 사본을 둔다.
// 형식은 `wrangler d1 export`처럼 SQL 텍스트(gzip) — 복구는 풀어서 빈 D1에 그대로 실행한다:
//   gunzip -c 2026-09-28.sql.gz > dump.sql && wrangler d1 execute <새 DB> --remote --file dump.sql
// DB 전체를 메모리에 올리지 않게 표를 rowid 순으로 PAGE씩 읽어 gzip 스트림으로 흘리고, R2에는 멀티파트로 올린다.

/** 한 번에 읽는 행 수 — 시즌 기록(events_json)이 커도 응답이 수 MB를 넘지 않게. */
const PAGE = 2000;
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
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType: 'application/sql', contentEncoding: 'gzip' },
  });
  const gzip = new CompressionStream('gzip');
  const writer = gzip.writable.getWriter();
  const encoder = new TextEncoder();
  const write = (s: string) => writer.write(encoder.encode(s));

  // 압축된 바이트를 모아 PART_BYTES마다 조각으로 올린다(쓰기와 동시에 돈다).
  const parts: R2UploadedPart[] = [];
  let bytes = 0;
  const uploading = (async () => {
    const reader = gzip.readable.getReader();
    let buf: Uint8Array[] = [];
    let size = 0;
    const flush = async () => {
      parts.push(await upload.uploadPart(parts.length + 1, new Blob(buf)));
      bytes += size;
      buf = [];
      size = 0;
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf.push(value);
      size += value.byteLength;
      if (size >= PART_BYTES) await flush();
    }
    if (size > 0) await flush(); // 머리글을 늘 쓰므로 조각은 적어도 하나다
  })();

  let rows = 0;
  try {
    await write(
      `-- offside D1 backup · ${env} · ${new Date(now).toISOString()}\nPRAGMA defer_foreign_keys = true;\n`,
    );
    for (const t of tables) await write(`${t.sql};\n`);
    for (const t of tables) {
      let after = 0;
      for (;;) {
        const page = await db
          .prepare(
            `SELECT rowid AS __rowid, * FROM ${q(t.name)} WHERE rowid > ?1 ORDER BY rowid LIMIT ${PAGE}`,
          )
          .bind(after)
          .raw<unknown[]>({ columnNames: true });
        const [cols, ...data] = page as [string[], ...unknown[][]];
        if (!cols || data.length === 0) break;
        const insert = `INSERT INTO ${q(t.name)} (${cols.slice(1).map(q).join(', ')}) VALUES `;
        await write(
          data.map((r) => `${insert}(${r.slice(1).map(literal).join(', ')});\n`).join(''),
        );
        rows += data.length;
        after = Number(data[data.length - 1]![0]);
        if (data.length < PAGE) break;
      }
    }
    // 인덱스·트리거는 데이터를 넣은 뒤에 만든다(넣는 동안 인덱스를 고치지 않게).
    for (const s of schema) if (s.type !== 'table') await write(`${s.sql};\n`);
    await writer.close();
    await uploading;
    await upload.complete(parts);
  } catch (e) {
    await writer.abort(e).catch(() => {});
    await uploading.catch(() => {});
    await upload.abort().catch(() => {});
    throw e;
  }

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
