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
import zlib


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def violations(db):
    """Foreign key violations as (child table, child rowid, parent table, fk id)."""
    return [r for r in db.execute('PRAGMA foreign_key_check')]


def repair_orphans(db, limit):
    """Remove rows whose ON DELETE CASCADE parent is gone, and clear ON DELETE SET NULL references.

    The live copy keeps children of a parent that was deleted while the backup ran; production
    would have removed them with the parent. Other foreign keys are left for the check to report.
    Returns removed/cleared counts per child table, or None when more than `limit` rows need repair
    (that many orphans means missing parents, not deletions).
    """
    done = {}
    for _ in range(8):
        found = violations(db)
        if not found:
            break
        fixable = 0
        actions = {}
        for table, rowid, _parent, fk in found:
            if rowid is None:
                continue
            if (table, fk) not in actions:
                rows = [r for r in db.execute('PRAGMA foreign_key_list(' + quote(table) + ')') if r[0] == fk]
                action = rows[0][6].upper() if rows else ''
                actions[(table, fk)] = (action, [r[3] for r in rows])
            action, columns = actions[(table, fk)]
            if action == 'CASCADE':
                db.execute('DELETE FROM ' + quote(table) + ' WHERE rowid = ?', (rowid,))
            elif action == 'SET NULL':
                db.execute('UPDATE ' + quote(table) + ' SET ' + ', '.join(quote(c) + ' = NULL' for c in columns) + ' WHERE rowid = ?', (rowid,))
            else:
                continue
            fixable += 1
            done[table] = done.get(table, 0) + 1
            if sum(done.values()) > limit:
                return None
        if not fixable:
            break
    return done


def restore(source, destination, chunks, expected_tables, expected_rows, min_rows=None, repair_limit=None):
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
        # Sealed copies end with INSERT OR REPLACE rows. With enforcement on, replacing a parent
        # would cascade-delete children restored earlier; integrity is checked explicitly below.
        db.execute('PRAGMA foreign_keys = OFF')
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
        repaired = None
        if repair_limit is not None:
            db.execute('BEGIN')
            repaired = repair_orphans(db, repair_limit)
            if repaired is None:
                db.rollback()
            else:
                db.commit()
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        rows = sum(db.execute('SELECT count(*) FROM "' + t.replace('"', '""') + '"').fetchone()[0] for t in tables)
        integrity = [r[0] for r in db.execute('PRAGMA integrity_check')]
        by_table = {}
        for table, _rowid, parent, _fk in violations(db):
            by_table[table + ' -> ' + parent] = by_table.get(table + ' -> ' + parent, 0) + 1
        foreign_keys = sum(by_table.values())
        removed = sum((repaired or {}).values())
        result = {'chunks': chunks, 'tables': len(tables), 'rows': rows,
                  'integrityOk': integrity == ['ok'], 'foreignKeyViolations': foreign_keys,
                  'expectedTables': expected_tables, 'expectedRows': expected_rows,
                  # Table names only (schema is public); never keys or row contents.
                  'foreignKeyTables': by_table,
                  'orphansRepaired': removed, 'orphanTables': repaired or {},
                  'orphanLimitExceeded': repair_limit is not None and repaired is None,
                  'countsMatch': (expected_tables is None or len(tables) == expected_tables) and (expected_rows is None or (min_rows - removed <= rows <= expected_rows if min_rows is not None else rows == expected_rows)),
                  'restoreSeconds': round(time.monotonic() - started, 2),
                  'databaseBytes': destination.stat().st_size}
        # Never include SQL, keys or row contents in reports.
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
    # Sealed copies re-emit rows (INSERT OR REPLACE), so the restored count may be lower than
    # the emitted statement count, but never below this bound.
    parser.add_argument('--min-rows', type=int)
    # Remove children of parents deleted during the backup (ON DELETE CASCADE / SET NULL only),
    # up to this many rows. Above the limit nothing is changed and the violations are reported.
    parser.add_argument('--repair-orphans', type=int)
    args = parser.parse_args()
    try:
        result = restore(args.source, args.destination, args.chunks, args.tables, args.rows, args.min_rows, args.repair_orphans)
        print(json.dumps(result))
        return 0 if result['integrityOk'] and result['countsMatch'] and result['foreignKeyViolations'] == 0 else 1
    except (ValueError, OSError, EOFError, zlib.error, sqlite3.Error):
        # SQLite error text can include SQL/row values. Keep private dumps off stdout/CI.
        print(json.dumps({'error': 'Local restore failed; inspect private input and destination.'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
