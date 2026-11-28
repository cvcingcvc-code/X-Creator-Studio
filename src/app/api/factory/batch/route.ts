import { NextRequest, NextResponse } from 'next/server';
import { CreationFactoryService } from '@/lib/factory/creation-factory.service';
import { getDb } from '@/lib/db/client';
import { BatchCount } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle') || '@creator';

  const db = getDb();
  const batches = db.prepare(`
    SELECT * FROM creation_batches WHERE creator_handle = ? ORDER BY created_at DESC LIMIT 20
  `).all(handle) as any[];

  return NextResponse.json({
    batches,
    runtime: CreationFactoryService.getModelRuntimeStatus()
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const creatorHandle = body.creatorHandle || '@creator';
    const count = (body.count || 5) as BatchCount;
    const customTopic = body.customTopic;

    if (![1, 5, 10, 20].includes(count)) {
      return NextResponse.json({ error: '生成批次数量仅支持 1、5、10 或 20 组' }, { status: 400 });
    }

    const batch = await CreationFactoryService.startBatchCreation({
      creatorHandle,
      count,
      customTopic,
      textModel: body.textModel,
      imageModel: body.imageModel
    });

    return NextResponse.json({ success: true, batch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
