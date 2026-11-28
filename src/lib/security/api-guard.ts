import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

export interface GuardOptions {
  /** 是否属于高成本 AI 生成类请求（适用更严格的每分钟频控） */
  isAiGeneration?: boolean;
  /** 本次预计生成的条目数（用于每日生成上限熔断） */
  requestedItemCount?: number;
  /** 仅校验访问口令（跳过限流） */
  passcodeOnly?: boolean;
}

const rateBuckets = new Map<string, number[]>();

function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'local');
  return ip || 'local';
}

function getConfiguredPasscode(): string {
  return (process.env.STUDIO_ACCESS_PASSCODE || process.env.AI_ACCESS_PASSCODE || '').trim();
}

export function resetApiGuardForTests(): void {
  rateBuckets.clear();
}

/**
 * 统一服务端安全护栏：
 * 1. 当服务端配置了 STUDIO_ACCESS_PASSCODE / AI_ACCESS_PASSCODE 时，强制校验访问口令
 * 2. 基于滑动时间窗的每分钟请求限流
 * 3. 针对 AI 批量生成接口的每日条目上限熔断（防止刷爆 API 额度）
 */
export function enforceApiGuard(req: NextRequest, options: GuardOptions = {}): NextResponse | null {
  // 1. 访问口令校验（未配置时本地开发平滑放行；配置后严格拒绝未授权访问）
  const expectedPasscode = getConfiguredPasscode();
  if (expectedPasscode) {
    const headerPasscode = (req.headers.get('x-studio-passcode') || '').trim();
    const authHeader = (req.headers.get('authorization') || '').trim();
    const bearerPasscode = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const provided = headerPasscode || bearerPasscode;

    if (!provided || provided !== expectedPasscode) {
      return NextResponse.json(
        {
          error: '未授权访问：服务端已启用访问口令保护，请在请求头中提供有效的 x-studio-passcode。',
          code: 'UNAUTHORIZED_PASSCODE'
        },
        { status: 401 }
      );
    }
  }

  if (options.passcodeOnly) {
    return null;
  }

  // 2. 每分钟滑动窗口限流
  const now = Date.now();
  const windowMs = 60_000;
  const maxPerMin = options.isAiGeneration
    ? Math.max(1, Number(process.env.AI_BATCH_RATE_LIMIT_PER_MIN || 10))
    : Math.max(1, Number(process.env.API_RATE_LIMIT_PER_MIN || 60));

  const bucketKey = `${options.isAiGeneration ? 'ai' : 'api'}:${getClientKey(req)}`;
  const history = (rateBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs);
  if (history.length >= maxPerMin) {
    return NextResponse.json(
      {
        error: `请求过于频繁：已触发每分钟 ${maxPerMin} 次限流保护，请稍后重试。`,
        code: 'RATE_LIMIT_EXCEEDED'
      },
      { status: 429 }
    );
  }
  history.push(now);
  rateBuckets.set(bucketKey, history);

  // 3. 每日 AI 生成条目预算熔断
  if (options.isAiGeneration && options.requestedItemCount && options.requestedItemCount > 0) {
    const dailyMaxItems = Math.max(1, Number(process.env.AI_DAILY_MAX_ITEMS || 100));
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const db = getDb();
    const row = db
      .prepare(`SELECT COUNT(*) AS cnt FROM generation_items WHERE created_at LIKE ?`)
      .get(`${todayPrefix}%`) as { cnt: number } | undefined;
    const todayUsed = Number(row?.cnt || 0);

    if (todayUsed + options.requestedItemCount > dailyMaxItems) {
      return NextResponse.json(
        {
          error: `已触发每日生成配额熔断：今日已生成 ${todayUsed} 条，本次请求 ${options.requestedItemCount} 条，超过每日上限 ${dailyMaxItems} 条。`,
          code: 'DAILY_BUDGET_EXCEEDED',
          todayUsed,
          dailyMaxItems
        },
        { status: 429 }
      );
    }
  }

  return null;
}
