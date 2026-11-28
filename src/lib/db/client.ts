import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';
import { seedInitialData } from './seed';

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

export function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured === ':memory:') return ':memory:';
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), './data/x-creator.db');
}

export function getDb(): DatabaseSync {
  const targetPath = resolveDbPath();
  if (dbInstance && currentDbPath === targetPath) {
    return dbInstance;
  }

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new DatabaseSync(targetPath);
  currentDbPath = targetPath;

  // 启用 WAL 模式以提升并发与持久化性能
  if (targetPath !== ':memory:') {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec(SCHEMA_SQL);

  // 初始化基础官方合规规则库（不预置私人账号数据）
  seedInitialData(dbInstance);

  return dbInstance;
}

export function resetDbForTests(dbPath = ':memory:'): DatabaseSync {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = new DatabaseSync(dbPath);
  currentDbPath = dbPath;
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec(SCHEMA_SQL);
  seedInitialData(dbInstance);
  return dbInstance;
}
