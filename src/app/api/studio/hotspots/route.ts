import { NextRequest, NextResponse } from 'next/server';
import { StudioDeskService } from '@/lib/studio/studio-desk.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle') || '@creator';

  const hotspots = StudioDeskService.listHotspots(handle);
  const summary = StudioDeskService.getSummary(handle);

  return NextResponse.json({ hotspots, summary });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const creatorHandle = body.creatorHandle || '@creator';
    const rawText = String(body.rawText || '').trim();
    const sourceNote = String(body.sourceNote || '人工/同事导入').trim();

    if (!rawText) {
      return NextResponse.json({ error: '请粘贴至少一条热点内容' }, { status: 400 });
    }

    const result = StudioDeskService.importHotspots(creatorHandle, rawText, sourceNote);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '导入热点失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '缺少热点 id' }, { status: 400 });
  }
  const deleted = StudioDeskService.deleteHotspot(id);
  return NextResponse.json({ success: deleted });
}
