import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeImporterService, RawPostInput } from '@/lib/knowledge/knowledge-importer.service';
import { enforceApiGuard } from '@/lib/security/api-guard';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_IMPORT_POSTS = 5000;

export async function POST(req: NextRequest) {
  const blocked = enforceApiGuard(req);
  if (blocked) return blocked;

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

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `上传文件体积超过上限（最大支持 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB）` },
          { status: 413 }
        );
      }

      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `上传文件体积超过上限（最大支持 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB）` },
          { status: 413 }
        );
      }
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
        if (Buffer.byteLength(body.rawText, 'utf8') > MAX_UPLOAD_BYTES) {
          return NextResponse.json({ error: '文本导入内容超过 10 MB 上限' }, { status: 413 });
        }
        posts = KnowledgeImporterService.parsePlainText(body.rawText);
      } else {
        return NextResponse.json({ error: '请求数据格式不符合预期' }, { status: 400 });
      }
    }

    if (posts.length > MAX_IMPORT_POSTS) {
      return NextResponse.json(
        { error: `单次最多导入 ${MAX_IMPORT_POSTS} 条帖子，当前共 ${posts.length} 条，请分批导入` },
        { status: 400 }
      );
    }

    const result = KnowledgeImporterService.importPosts(creatorHandle, posts, sourceType);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '导入处理失败' }, { status: 500 });
  }
}
