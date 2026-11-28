import { NextRequest, NextResponse } from 'next/server';
import { CreationFactoryService } from '@/lib/factory/creation-factory.service';
import { getDb } from '@/lib/db/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const batch = db.prepare('SELECT * FROM creation_batches WHERE id = ?').get(id) as any;
  if (!batch) {
    return NextResponse.json({ error: '未找到批次记录' }, { status: 404 });
  }

  const items = db.prepare(`
    SELECT * FROM generation_items WHERE batch_id = ? ORDER BY sequence_no ASC
  `).all(id) as any[];

  const formattedItems = items.map(it => ({
    id: it.id,
    batchId: it.batch_id,
    topic: it.title,
    angle: it.angle,
    imagePrompt: it.image_prompt,
    imageUrl: it.image_url || undefined,
    imageSource: it.image_url ? 'manual_uploaded' : 'unconfigured',
    generatedText: it.generated_text,
    originalityScore: it.originality_score,
    originalityStatus: it.originality_status,
    originalityReasons: JSON.parse(it.originality_reasons || '[]'),
    complianceStatus: it.compliance_status,
    complianceViolations: JSON.parse(it.compliance_violations || '[]'),
    sources: JSON.parse(it.sources || '[]'),
    status: it.status,
    isConfirmed: Boolean(it.is_confirmed)
  }));

  return NextResponse.json({
    ...batch,
    items: formattedItems
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action; // 'regenerate' | 'confirm' | 'pause' | 'resume'
    const itemId = body.itemId;

    if (action === 'pause' || action === 'resume') {
      const updatedBatch = CreationFactoryService.updateBatchStatus(
        id,
        action === 'pause' ? 'paused' : 'completed'
      );
      if (!updatedBatch) {
        return NextResponse.json({ error: '未找到批次记录' }, { status: 404 });
      }
      return NextResponse.json({ success: true, batch: updatedBatch });
    }

    if (!itemId) {
      return NextResponse.json({ error: '必须指定 itemId' }, { status: 400 });
    }

    if (action === 'regenerate') {
      const updated = await CreationFactoryService.regenerateItem(id, itemId);
      return NextResponse.json({ success: true, item: updated });
    }

    if (action === 'confirm') {
      const confirmResult = CreationFactoryService.confirmItem(id, itemId);
      return NextResponse.json({ success: true, ...confirmResult });
    }

    return NextResponse.json({ error: '不支持的 action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.batchStatus && ['paused', 'running', 'completed'].includes(body.batchStatus)) {
      const updatedBatch = CreationFactoryService.updateBatchStatus(id, body.batchStatus);
      return NextResponse.json({ success: true, batch: updatedBatch });
    }

    if (!body.itemId) {
      return NextResponse.json({ error: '必须指定 itemId' }, { status: 400 });
    }

    const updatedItem = await CreationFactoryService.updateItem(id, body.itemId, {
      generatedText: body.generatedText,
      imageUrl: body.imageUrl,
      topic: body.topic,
      angle: body.angle
    });

    if (!updatedItem) {
      return NextResponse.json({ error: '未找到对应生成项' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新失败' }, { status: 500 });
  }
}
