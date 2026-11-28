import { NextRequest, NextResponse } from 'next/server';
import { ComplianceEngineService, validateSafeRegexPattern } from '@/lib/compliance/compliance-engine.service';
import { enforceApiGuard } from '@/lib/security/api-guard';

export async function GET() {
  const rules = ComplianceEngineService.getActiveRules();
  return NextResponse.json({ total: rules.length, rules });
}

export async function POST(req: NextRequest) {
  const blocked = enforceApiGuard(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    if (!body.code || !body.name || !body.category || !body.description) {
      return NextResponse.json(
        { error: '缺少必填字段：code、name、category、description' },
        { status: 400 }
      );
    }

    const regexPattern = body.regexPattern ? String(body.regexPattern) : '';
    const regexCheck = validateSafeRegexPattern(regexPattern);
    if (!regexCheck.valid) {
      return NextResponse.json(
        { error: regexCheck.reason || '正则表达式存在安全风险或语法错误' },
        { status: 400 }
      );
    }

    const severity = ['warning', 'critical', 'info'].includes(body.severity)
      ? body.severity
      : 'warning';

    const rule = ComplianceEngineService.upsertRule({
      code: String(body.code).trim(),
      name: String(body.name).trim(),
      category: String(body.category).trim(),
      severity,
      description: String(body.description).trim(),
      region: body.region ? String(body.region).trim() : 'Global',
      officialSourceUrl: body.officialSourceUrl
        ? String(body.officialSourceUrl).trim()
        : 'https://help.x.com/en/rules-and-policies',
      ruleVersion: body.ruleVersion ? String(body.ruleVersion).trim() : '2026.2',
      regexPattern,
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      isActive: body.isActive !== false
    });

    return NextResponse.json({ success: true, rule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '保存规则失败' }, { status: 500 });
  }
}
