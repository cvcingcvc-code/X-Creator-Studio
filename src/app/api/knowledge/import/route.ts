import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeImporterService, RawPostInput } from '@/lib/knowledge/knowledge-importer.service';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let creatorHandle = '@creator';
    let posts: RawPostInput[] = [];
    let sourceType: 'csv' | 'json' | 'excel' | 'text' | 'manual' = 'manual';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const handle = formData.get('creatorHandle') as string | null;
      if (handle) creatorHandle = handle;

      if (!file) {
        return NextResponse.json({ error: '未上传文件' }, { status: 400 });
      }

      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (fileName.endsWith('.json')) {
        sourceType = 'json';
        posts = KnowledgeImporterService.parseJson(buffer.toString('utf8'));
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        sourceType = fileName.endsWith('.csv') ? 'csv' : 'excel';
        posts = KnowledgeImporterService.parseSpreadsheet(buffer);
      } else {
        sourceType = 'text';
        posts = KnowledgeImporterService.parsePlainText(buffer.toString('utf8'));
      }
    } else {
      const body = await req.json();
      if (body.creatorHandle) creatorHandle = body.creatorHandle;
      sourceType = body.sourceType || 'manual';

      if (Array.isArray(body.posts)) {
        posts = body.posts;
      } else if (typeof body.rawText === 'string') {
        posts = KnowledgeImporterService.parsePlainText(body.rawText);
      } else {
        return NextResponse.json({ error: '请求数据格式不符合预期' }, { status: 400 });
      }
    }

    const result = KnowledgeImporterService.importPosts(creatorHandle, posts, sourceType);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '导入处理失败' }, { status: 500 });
  }
}
