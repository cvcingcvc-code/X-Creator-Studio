import { NextRequest, NextResponse } from 'next/server';
import { ComplianceEngineService } from '@/lib/compliance/compliance-engine.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, creatorHandle, hasAutoPublishRequested } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: '待审核文本不能为空' }, { status: 400 });
    }

    const result = ComplianceEngineService.auditContent({
      text,
      creatorHandle: creatorHandle || '@creator',
      hasAutoPublishRequested
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const rules = ComplianceEngineService.getActiveRules();
  return NextResponse.json({ total: rules.length, rules });
}
