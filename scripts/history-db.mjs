#!/usr/bin/env node
/**
 * SQLite plumbing for the trend history, kept out of the shell scripts.
 *
 * Three jobs, none of which need a dependency — `node:sqlite` is built into
 * Node 24, which is the whole reason the history costs nothing to deploy and
 * puts no native module on a Raspberry Pi.
 *
 *   check <data-dir>       Prove node:sqlite works and the directory is writable
 *   stats <db-file>        What one history file contains
 *   export [src] [dest]    A single portable copy of a live database
 *
 * `export` is `VACUUM INTO`, not a file copy, and that distinction matters
 * here. The database runs in WAL mode, so recent writes live in a `-wal`
 * sidecar until a checkpoint folds them in — copying `trends.db` on its own
 * can carry a fraction of the data and look like it worked. `VACUUM INTO`
 * reads the WAL too and writes one consistent file with no sidecars.
 */

import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_SRC = 'apps/api/data/trends.db';
const DEFAULT_DEST = 'apps/api/data/trends-seed.db';

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case 'check':
      check(args[0] ?? 'apps/api/data');
      break;
    case 'stats':
      stats(args[0] ?? DEFAULT_SRC);
      break;
    case 'export':
      exportTo(args[0] ?? DEFAULT_SRC, args[1] ?? DEFAULT_DEST);
      break;
    default:
      console.error('usage: history-db.mjs check <data-dir> | stats <db> | export [src] [dest]');
      process.exit(2);
  }
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

/**
 * Writes to a throwaway database in the real data directory and reads it back.
 *
 * Both halves are the point. That `node:sqlite` imports proves the Node build
 * is new enough; that a WAL-mode write survives a read-back proves this
 * particular directory on this particular filesystem will take one — which is
 * the half that fails on a Pi with a full or read-only SD card.
 */
function check(dataDir) {
  const dir = resolve(dataDir);
  mkdirSync(dir, { recursive: true });

  const probe = resolve(dir, '.sqlite-probe.db');
  cleanUp(probe);

  let mode;
  try {
    const db = new DatabaseSync(probe);
    mode = db.prepare('PRAGMA journal_mode = WAL').get().journal_mode;
    db.exec('CREATE TABLE probe (value INTEGER NOT NULL)');
    db.prepare('INSERT INTO probe VALUES (?)').run(42);
    const row = db.prepare('SELECT value FROM probe').get();
    db.close();

    if (row?.value !== 42) throw new Error('wrote a row but read back something else');
  } finally {
    cleanUp(probe);
  }

  console.log(`node:sqlite works (Node ${process.versions.node}, SQLite ${sqliteVersion()})`);
  console.log(`${dir} is writable, journal_mode=${mode}`);
}

function stats(file) {
  const path = resolve(file);
  const db = new DatabaseSync(path);

  const row = db
    .prepare(
      `SELECT COUNT(*)                   AS rows,
              COUNT(DISTINCT trend_key)  AS trends,
              COUNT(DISTINCT observed_at) AS fetches,
              MIN(observed_at)           AS first_seen,
              MAX(observed_at)           AS last_seen
       FROM trend_snapshots`,
    )
    .get();
  db.close();

  if (row.rows === 0) {
    console.log(`${path}: no observations recorded`);
    return;
  }

  const spanMinutes = Math.round(
    (Date.parse(row.last_seen) - Date.parse(row.first_seen)) / 60_000,
  );
  console.log(
    `${path}: ${row.rows} rows, ${row.trends} trends, ${row.fetches} fetches, ` +
      `${hours(spanMinutes)} of history, ${kb(path)}`,
  );
  console.log(`  earliest ${row.first_seen}`);
  console.log(`  latest   ${row.last_seen}`);
}

/**
 * One consistent file, WAL contents folded in and no sidecars beside it.
 *
 * `VACUUM INTO` refuses to overwrite, which is the safety we want: on the Pi
 * the destination is a database that may already hold history nobody wants to
 * lose, so the caller has to remove it deliberately first.
 */
function exportTo(src, dest) {
  const from = resolve(src);
  const to = resolve(dest);

  if (from === to) throw new Error('source and destination are the same file');
  mkdirSync(dirname(to), { recursive: true });

  const db = new DatabaseSync(from, { readOnly: false });
  try {
    db.exec(`VACUUM INTO '${to.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  console.log(`wrote ${to} (${kb(to)})`);
  stats(to);
}

function cleanUp(probe) {
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(probe + suffix, { force: true });
  }
}

function sqliteVersion() {
  const db = new DatabaseSync(':memory:');
  const version = db.prepare('SELECT sqlite_version() AS v').get().v;
  db.close();
  return version;
}

function kb(path) {
  return `${Math.round(statSync(path).size / 1024)} KB`;
}

function hours(minutes) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
