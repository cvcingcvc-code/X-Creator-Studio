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

export function getPersistenceStatus(): {
  driver: 'sqlite';
  dbPath: string;
  isEphemeralWarning: boolean;
  warningMessage?: string;
} {
  const dbPath = resolveDbPath();
  const isVercel = Boolean(process.env.VERCEL);
  const isMemory = dbPath === ':memory:';
  const isEphemeralWarning = isMemory || (isVercel && !process.env.DATABASE_PATH);
  return {
    driver: 'sqlite',
    dbPath,
    isEphemeralWarning,
    warningMessage: isEphemeralWarning
      ? '当前运行于无状态临时存储或内存数据库，实例重启/冷启动后数据可能丢失；生产云端部署请挂载持久化卷或接入托管 Postgres。'
      : undefined
  };
}

function runAdditiveMigrations(db: DatabaseSync) {
  try {
    const cols = db.prepare(`PRAGMA table_info(generation_items)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'image_source')) {
      db.exec(`ALTER TABLE generation_items ADD COLUMN image_source TEXT NOT NULL DEFAULT 'unconfigured';`);
    }
  } catch {
    // ignore if table already up to date
  }
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
  runAdditiveMigrations(dbInstance);

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
