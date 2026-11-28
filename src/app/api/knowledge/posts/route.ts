import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { KnowledgeImporterService } from '@/lib/knowledge/knowledge-importer.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle') || '@creator';
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  const db = getDb();
  let query = 'SELECT * FROM knowledge_posts WHERE creator_handle = ? AND status != ?';
  const params: any[] = [handle, 'deleted'];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (original_text LIKE ? OR theme LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY published_at DESC LIMIT 100';

  const rows = db.prepare(query).all(...params) as any[];

  const posts = rows.map(r => ({
    id: r.id,
    creatorHandle: r.creator_handle,
    postId: r.post_id,
    originalText: r.original_text,
    textHash: r.text_hash,
    publishedAt: r.published_at,
    originalUrl: r.original_url,
    mediaUrls: JSON.parse(r.media_urls || '[]'),
    theme: r.theme,
    coreViewpoint: r.core_viewpoint,
    expressionStyle: r.expression_style,
    sourceReferences: JSON.parse(r.source_references || '[]'),
    keywords: JSON.parse(r.keywords || '[]'),
    category: r.category,
    impressions: r.impressions,
    likes: r.likes,
    replies: r.replies,
    retweets: r.retweets,
    sourceType: r.source_type,
    status: r.status,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  return NextResponse.json({ total: posts.length, posts });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const handle = body.creatorHandle || '@creator';
    const text = body.originalText;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: '帖子正文不能为空' }, { status: 400 });
    }

    const result = KnowledgeImporterService.importPosts(handle, [{
      originalText: text,
      publishedAt: body.publishedAt || new Date().toISOString(),
      theme: body.theme,
      coreViewpoint: body.coreViewpoint,
      category: body.category,
      impressions: body.impressions,
      likes: body.likes,
      replies: body.replies,
      retweets: body.retweets,
      status: body.status || 'published'
    }], 'manual');

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const handle = searchParams.get('handle');
    const permanent = searchParams.get('permanent') === 'true';

    const db = getDb();
    const now = new Date().toISOString();

    if (id) {
      if (permanent) {
        const res = db.prepare('DELETE FROM knowledge_posts WHERE id = ?').run(id);
        return NextResponse.json({ success: true, deletedCount: Number(res.changes) });
      }
      const res = db.prepare(`UPDATE knowledge_posts SET status = 'deleted', updated_at = ? WHERE id = ?`).run(now, id);
      return NextResponse.json({ success: true, deletedCount: Number(res.changes) });
    }

    if (handle) {
      const res = permanent
        ? db.prepare('DELETE FROM knowledge_posts WHERE creator_handle = ?').run(handle)
        : db.prepare(`UPDATE knowledge_posts SET status = 'deleted', updated_at = ? WHERE creator_handle = ?`).run(now, handle);
      return NextResponse.json({ success: true, deletedCount: Number(res.changes) });
    }

    return NextResponse.json({ error: '请提供要删除的帖子 id 或 creator handle' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '删除失败' }, { status: 500 });
  }
}
