import { NextRequest, NextResponse } from 'next/server';
import { StudioDeskService } from '@/lib/studio/studio-desk.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle') || '@creator';
  const filter = searchParams.get('status') as 'ready' | 'published' | null;

  const drafts = StudioDeskService.listDrafts(handle, filter || undefined);
  const summary = StudioDeskService.getSummary(handle);

  return NextResponse.json({ drafts, summary });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const draftId = String(body.draftId || '').trim();
    const action = body.action as 'copy' | 'publish' | 'unpublish';

    if (!draftId || !['copy', 'publish', 'unpublish'].includes(action)) {
      return NextResponse.json({ error: '缺少有效 draftId 或 action' }, { status: 400 });
    }

    const updated = StudioDeskService.markDraftAction(draftId, action, body.publishedUrl);
    if (!updated) {
      return NextResponse.json({ error: '未找到该文案记录' }, { status: 404 });
    }

    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新状态失败' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '缺少文案 id' }, { status: 400 });
  }
  const deleted = StudioDeskService.deleteDraft(id);
  return NextResponse.json({ success: deleted });
}
