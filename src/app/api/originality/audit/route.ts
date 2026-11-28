import { NextRequest, NextResponse } from 'next/server';
import { OriginalityService } from '@/lib/originality/originality.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, creatorHandle, imageUrl, batchId } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: '待查重文本不能为空' }, { status: 400 });
    }

    const result = await OriginalityService.auditContent({
      text,
      creatorHandle: creatorHandle || '@creator',
      imageUrl,
      batchId
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
