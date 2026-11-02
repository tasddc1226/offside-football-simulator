#!/usr/bin/env python3
"""Pack/verify a trusted native D1 SQL export; local-only, never fixes/drops orphan rows."""
import argparse
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import time
import zlib

spec = importlib.util.spec_from_file_location('restore_backup', Path(__file__).with_name('restore-backup.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
LIMIT = 32 * 1024 * 1024
MAX_STATEMENT = 16 * 1024 * 1024
FORMAT = 'offside-d1-snapshot-v1'


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def valid(result):
    return result['countsMatch'] and result['integrityOk'] and result['foreignKeyViolations'] == 0


def pack(sql, output, database_id, bookmark, snapshot_at=None):
    output = Path(output)
    output.mkdir(mode=0o700)  # exclusive: never reuse another capture's directory
    count = 0
    size = 0
    stream = None
    statement = ''
    try:
        with open(sql, encoding='utf-8') as source:
            for line in source:
                statement += line
                if len(statement.encode('utf-8')) > MAX_STATEMENT:
                    raise ValueError('SQL statement exceeds local packing bound')
                if not sqlite3.complete_statement(statement):
                    continue
                # Native exports normally omit transactions; allow trusted SQLite dumps too.
                if statement.strip().upper() not in ('BEGIN TRANSACTION;', 'BEGIN;', 'COMMIT;'):
                    data = statement.encode('utf-8')
                    if stream is None or size >= LIMIT:
                        if stream:
                            stream.close()
                        count += 1
                        stream = gzip.open(output / f'{count:04d}.sql', 'wb')
                        size = 0
                    stream.write(data)
                    size += len(data)
                statement = ''
        if statement.strip() and any(s.strip() and not s.lstrip().startswith('--') for s in statement.splitlines()):
            raise ValueError('Incomplete exported SQL')
    finally:
        if stream:
            stream.close()
    restored = output / 'validation.sqlite'
    result = module.restore(output, restored, count, None, None)
    try:
        if not valid(result):
            raise ValueError('Snapshot failed relational/integrity validation')
        chunks = [{'file': f'{i:04d}.sql', 'object': f'{i:04d}.sql.gz',
                   'sha256': digest(output / f'{i:04d}.sql'), 'bytes': (output / f'{i:04d}.sql').stat().st_size}
                  for i in range(1, count + 1)]
        manifest = {'format': FORMAT, 'consistency': 'd1-native-export', 'databaseId': database_id,
                    'bookmark': bookmark, 'createdAt': snapshot_at if snapshot_at is not None else int(time.time() * 1000), 'chunks': chunks,
                    'tables': result['tables'], 'rows': result['rows'], 'verified': True}
        (output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        return {**result, 'verified': True, 'chunks': count}
    finally:
        restored.unlink(missing_ok=True)


def verify(source, destination):
    source = Path(source)
    manifest = json.loads((source / 'manifest.json').read_text())
    chunks = manifest.get('chunks')
    if manifest.get('format') != FORMAT or manifest.get('consistency') != 'd1-native-export' or not isinstance(chunks, list) or not 1 <= len(chunks) <= 10000:
        raise ValueError('Invalid snapshot manifest')
    for i, chunk in enumerate(chunks, 1):
        if chunk.get('file') != f'{i:04d}.sql' or chunk.get('object') != f'{i:04d}.sql.gz':
            raise ValueError('Invalid chunk path/order')
        path = source / chunk['file']
        if path.is_symlink() or path.stat().st_size != chunk['bytes'] or digest(path) != chunk['sha256']:
            raise ValueError('Snapshot transport integrity failure')
    result = module.restore(source, destination, len(chunks), manifest['tables'], manifest['rows'])
    return result


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    packing = sub.add_parser('pack')
    for name in ('sql', 'output', 'database-id', 'bookmark'):
        packing.add_argument('--' + name, required=True)
    packing.add_argument('--snapshot-at', type=int)
    checking = sub.add_parser('verify')
    checking.add_argument('--source', required=True)
    checking.add_argument('--destination', required=True)
    args = parser.parse_args()
    try:
        result = pack(args.sql, args.output, args.database_id, args.bookmark, args.snapshot_at) if args.mode == 'pack' else verify(args.source, args.destination)
        print(json.dumps(result))
        return 0 if valid(result) else 1
    except (ValueError, KeyError, TypeError, OSError, EOFError, zlib.error, sqlite3.Error):
        print(json.dumps({'error': 'Snapshot validation failed; no verified manifest published.'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
