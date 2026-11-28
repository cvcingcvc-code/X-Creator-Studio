import { NextRequest, NextResponse } from 'next/server';
import { StudioDeskService } from '@/lib/studio/studio-desk.service';
import { StudioGoalType } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const creatorHandle = body.creatorHandle || '@creator';
    const goalType = (['engagement', 'exposure', 'app_validation', 'custom'].includes(body.goalType)
      ? body.goalType
      : 'engagement') as StudioGoalType;

    const result = await StudioDeskService.generateDrafts({
      creatorHandle,
      hotspotId: body.hotspotId,
      hotspotText: body.hotspotText,
      hotspotTitle: body.hotspotTitle,
      goalType,
      goalDetail: body.goalDetail,
      count: Number(body.count || 3)
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '生成文案失败' }, { status: 400 });
  }
}
