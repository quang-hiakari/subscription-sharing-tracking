import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Test support: an in-memory SQLite (Node's built-in `node:sqlite`) behind the small part of the
// D1Database API the app uses, with the repo's real migrations applied. Lets tests run the
// production SQL, constraints and batch-as-transaction semantics without mocks.

interface SqliteStatement {
  run(...params: unknown[]): { changes: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

const nodeRequire = createRequire(import.meta.url);

export function createTestD1(): { db: D1Database; raw: SqliteDb } {
  const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');

  const dir = join(process.cwd(), 'd1', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) raw.exec(statement);
    }
  }

  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const statement = {
      bind(...args: unknown[]) {
        params = args;
        return statement;
      },
      runSync() {
        const { changes } = raw.prepare(sql).run(...params);
        return { success: true, meta: { changes: Number(changes) }, results: [] };
      },
      async run() {
        return statement.runSync();
      },
      async first() {
        return (raw.prepare(sql).get(...params) as unknown) ?? null;
      },
      async all() {
        return { success: true, results: raw.prepare(sql).all(...params), meta: {} };
      },
    };
    return statement;
  };

  const db = {
    prepare,
    // D1 runs a batch as one transaction (all statements apply or none do) without other requests
    // interleaving, so this runs synchronously between BEGIN and COMMIT.
    async batch(statements: ReturnType<typeof prepare>[]) {
      raw.exec('BEGIN');
      try {
        const results = statements.map((s) => s.runSync());
        raw.exec('COMMIT');
        return results;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return { db: db as unknown as D1Database, raw };
}
