#!/usr/bin/env python3
"""Restore downloaded backup chunks into a NEW local SQLite DB; no network or remote writes.
Input is trusted production SQL. Keep dumps/database private and outside the checkout.
Wrangler downloads are decoded SQL; raw S3 downloads may still be gzip.
"""
import argparse
import gzip
import json
import os
from pathlib import Path
import sqlite3
import time


def restore(source, destination, chunks, expected_tables, expected_rows):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not 1 <= chunks <= 10000:
        raise ValueError('Invalid chunk count')
    parts = [source / f'{i:04d}.sql' for i in range(1, chunks + 1)]
    if any(not p.is_file() or p.stat().st_size == 0 for p in parts):
        raise ValueError('Missing or empty backup chunk')
    # Exclusive creation: never overwrite an existing database or follow a symlink.
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    started = time.monotonic()
    db = sqlite3.connect(destination)
    try:
        db.execute('BEGIN')
        for part in parts:
            with part.open('rb') as raw:
                compressed = raw.read(2) == b'\x1f\x8b'
            opener = gzip.open if compressed else open
            statement = ''
            with opener(part, 'rt', encoding='utf-8') as stream:
                for line in stream:
                    statement += line
                    if sqlite3.complete_statement(statement):
                        db.execute(statement)
                        statement = ''
                if statement.strip():
                    # A trailing SQL comment is valid; incomplete SQL is not.
                    if any(s.strip() and not s.lstrip().startswith('--') for s in statement.splitlines()):
                        raise ValueError('Incomplete SQL chunk')
        db.commit()
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        rows = sum(db.execute('SELECT count(*) FROM "' + t.replace('"', '""') + '"').fetchone()[0] for t in tables)
        integrity = [r[0] for r in db.execute('PRAGMA integrity_check')]
        foreign_keys = sum(1 for _ in db.execute('PRAGMA foreign_key_check'))
        result = {'chunks': chunks, 'tables': len(tables), 'rows': rows,
                  'integrityOk': integrity == ['ok'], 'foreignKeyViolations': foreign_keys,
                  'expectedTables': expected_tables, 'expectedRows': expected_rows,
                  'countsMatch': len(tables) == expected_tables and rows == expected_rows,
                  'restoreSeconds': round(time.monotonic() - started, 2),
                  'databaseBytes': destination.stat().st_size}
        # Never include SQL, table names, keys or row contents in reports.
        return result
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--chunks', required=True, type=int)
    parser.add_argument('--tables', required=True, type=int)
    parser.add_argument('--rows', required=True, type=int)
    args = parser.parse_args()
    try:
        result = restore(args.source, args.destination, args.chunks, args.tables, args.rows)
        print(json.dumps(result))
        return 0 if result['integrityOk'] and result['countsMatch'] and result['foreignKeyViolations'] == 0 else 1
    except (ValueError, OSError, sqlite3.Error):
        # SQLite error text can include SQL/row values. Keep private dumps off stdout/CI.
        print(json.dumps({'error': 'Local restore failed; inspect private input and destination.'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
