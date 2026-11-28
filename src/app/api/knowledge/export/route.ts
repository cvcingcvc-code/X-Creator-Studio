import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { enforceApiGuard } from '@/lib/security/api-guard';
import { escapeCsvCell } from '@/lib/security/csv';

export async function GET(req: NextRequest) {
  const blocked = enforceApiGuard(req);
  if (blocked) return blocked;
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle') || '@creator';
  const format = (searchParams.get('format') || 'json').toLowerCase();

  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM knowledge_posts
    WHERE creator_handle = ? AND status != 'deleted'
    ORDER BY published_at DESC
  `).all(handle) as any[];

  const posts = rows.map(r => ({
    id: r.id,
    postId: r.post_id,
    creatorHandle: r.creator_handle,
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
    lastSyncedAt: r.last_synced_at
  }));

  const safeHandle = handle.replace(/[^a-zA-Z0-9_-]/g, '');

  if (format === 'csv') {
    const header = [
      'post_id', 'published_at', 'category', 'theme', 'core_viewpoint',
      'original_text', 'original_url', 'impressions', 'likes', 'replies', 'retweets', 'source_type', 'status'
    ];
    const lines = [
      header.join(','),
      ...posts.map(p => [
        p.postId, p.publishedAt, p.category, p.theme, p.coreViewpoint,
        p.originalText, p.originalUrl, p.impressions, p.likes, p.replies, p.retweets, p.sourceType, p.status
      ].map(escapeCsvCell).join(','))
    ];

    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="knowledge-${safeHandle || 'backup'}.csv"`
      }
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    creatorHandle: handle,
    total: posts.length,
    posts
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="knowledge-${safeHandle || 'backup'}.json"`
    }
  });
}
