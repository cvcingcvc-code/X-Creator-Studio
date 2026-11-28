import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/db/client';
import { KnowledgePost, ImportResult } from '@/types';

export interface RawPostInput {
  postId?: string;
  originalText: string;
  publishedAt?: string;
  originalUrl?: string;
  mediaUrls?: string[];
  theme?: string;
  coreViewpoint?: string;
  expressionStyle?: string;
  sourceReferences?: string[];
  keywords?: string[];
  category?: string;
  impressions?: number;
  likes?: number;
  replies?: number;
  retweets?: number;
  status?: 'published' | 'draft' | 'archived' | 'deleted';
}

export class KnowledgeImporterService {
  /**
   * 计算正文的 SHA-256 哈希值作为内容唯一指纹
   */
  public static computeTextHash(text: string): string {
    const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * 自动从正文中提取关键词与核心观点（启发式规则）
   */
  public static extractMetadata(text: string, existingTheme?: string, existingCategory?: string) {
    const cleanText = text.replace(/https?:\/\/\S+/g, '').trim();
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
    const coreViewpoint = lines.length > 0 ? lines[0].slice(0, 120) : '未提取到核心观点';

    // 常用中文及英文技术/创作者词汇提取
    const tagMatches = text.match(/#([\w\u4e00-\u9fa5]+)/g);
    const tags = tagMatches ? tagMatches.map(t => t.replace('#', '')) : [];

    const keywords = new Set<string>(tags);
    const techWords = [
      'AI', 'GPT', 'Agent', 'Claude', 'Gemini', 'LLM', '独立开发', '一人公司',
      '产品', '复盘', '踩坑', '出海', '增长', '流量', '运营', '自媒体',
      '开源', '自动化', 'Prompt', '工作流', 'Next.js', 'React', 'TypeScript'
    ];

    for (const word of techWords) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        keywords.add(word);
      }
    }

    let category = existingCategory || '未分类';
    if (!existingCategory) {
      if (keywords.has('AI') || keywords.has('Agent') || keywords.has('LLM')) category = 'AI 技术与工具';
      else if (keywords.has('独立开发') || keywords.has('一人公司')) category = '独立开发与创业';
      else if (keywords.has('运营') || keywords.has('流量') || keywords.has('自媒体')) category = '自媒体与增长';
      else if (keywords.has('复盘') || keywords.has('踩坑')) category = '经验踩坑与复盘';
      else category = '思考与日常';
    }

    const theme = existingTheme || (keywords.size > 0 ? Array.from(keywords).slice(0, 3).join('/') : '个人思考');

    // 风格推断
    let expressionStyle = '真诚接地气';
    if (text.includes('【') || text.includes('1.') || text.includes('核心要点')) {
      expressionStyle = '结构化干货拆解';
    } else if (text.includes('？') && lines.length > 3) {
      expressionStyle = '提问互动探索引导';
    } else if (text.includes('踩坑') || text.includes('教训') || text.includes('失败')) {
      expressionStyle = '真实经验复盘型';
    }

    return {
      coreViewpoint,
      keywords: Array.from(keywords),
      category,
      theme,
      expressionStyle
    };
  }

  /**
   * 导入单批格式化帖子数据并入库（具备严格防重幂等性）
   */
  public static importPosts(
    creatorHandle: string,
    rawPosts: RawPostInput[],
    sourceType: 'x_api' | 'csv' | 'json' | 'excel' | 'text' | 'manual'
  ): ImportResult {
    const db = getDb();
    const result: ImportResult = {
      totalProcessed: rawPosts.length,
      importedCount: 0,
      skippedDuplicates: 0,
      failedCount: 0,
      errors: []
    };

    const now = new Date().toISOString();

    // 保证创作者记录存在
    const creatorCheck = db.prepare('SELECT handle FROM creators WHERE handle = ?').get(creatorHandle);
    if (!creatorCheck) {
      db.prepare(`
        INSERT INTO creators (id, handle, name, bio, target_niche, tone_style, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `creator_${crypto.randomUUID()}`,
        creatorHandle,
        creatorHandle.replace(/^@/, ''),
        '创作者个人工作台',
        JSON.stringify(['AI 技术与工具', '独立开发与创业', '自媒体与增长', '经验踩坑与复盘']),
        '真诚接地气、结构清晰、结合真实案例与复盘',
        now,
        now
      );
    }

    // 准备查询与插入语句
    const checkStmt = db.prepare(`
      SELECT id, post_id, text_hash FROM knowledge_posts 
      WHERE creator_handle = ? AND (post_id = ? OR text_hash = ?)
    `);

    const insertStmt = db.prepare(`
      INSERT INTO knowledge_posts (
        id, creator_handle, post_id, original_text, text_hash,
        published_at, original_url, media_urls, theme, core_viewpoint,
        expression_style, source_references, keywords, category,
        impressions, likes, replies, retweets, source_type,
        status, raw_payload, last_synced_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    for (const post of rawPosts) {
      try {
        if (!post.originalText || !post.originalText.trim()) {
          result.failedCount++;
          result.errors.push('跳过空内容帖子');
          continue;
        }

        const cleanText = post.originalText.trim();
        const textHash = this.computeTextHash(cleanText);
        const resolvedPostId = post.postId || `gen_${textHash.slice(0, 16)}`;

        // 查重：同一创作者的相同 postId 或完全一致的内容哈希
        const existing = checkStmt.get(creatorHandle, resolvedPostId, textHash) as { id: string } | undefined;
        if (existing) {
          result.skippedDuplicates++;
          continue;
        }

        const meta = this.extractMetadata(cleanText, post.theme, post.category);
        const recordId = `kp_${crypto.randomUUID()}`;

        insertStmt.run(
          recordId,
          creatorHandle,
          resolvedPostId,
          cleanText,
          textHash,
          post.publishedAt || now,
          post.originalUrl || (post.postId ? `https://x.com/${creatorHandle.replace('@', '')}/status/${post.postId}` : ''),
          JSON.stringify(post.mediaUrls || []),
          meta.theme,
          post.coreViewpoint || meta.coreViewpoint,
          post.expressionStyle || meta.expressionStyle,
          JSON.stringify(post.sourceReferences || []),
          JSON.stringify(post.keywords && post.keywords.length > 0 ? post.keywords : meta.keywords),
          meta.category,
          post.impressions || 0,
          post.likes || 0,
          post.replies || 0,
          post.retweets || 0,
          sourceType,
          post.status || 'published',
          JSON.stringify(post),
          now,
          now,
          now
        );

        result.importedCount++;
      } catch (err: any) {
        result.failedCount++;
        result.errors.push(`导入错误: ${err?.message || String(err)}`);
      }
    }

    return result;
  }

  /**
   * 解析 JSON 格式
   */
  public static parseJson(content: string): RawPostInput[] {
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : (parsed.tweets || parsed.posts || [parsed]);
    return list.map((item: any) => ({
      postId: item.id || item.postId || item.tweet_id || item.id_str,
      originalText: item.text || item.full_text || item.content || item.originalText || '',
      publishedAt: item.created_at || item.publishedAt || item.date,
      originalUrl: item.url || item.originalUrl || item.link,
      mediaUrls: item.mediaUrls || (item.media ? item.media.map((m: any) => m.url || m) : []),
      theme: item.theme,
      coreViewpoint: item.coreViewpoint || item.viewpoint,
      expressionStyle: item.expressionStyle || item.style,
      category: item.category,
      impressions: Number(item.impressions || item.views || 0),
      likes: Number(item.likes || item.favorite_count || 0),
      replies: Number(item.replies || item.reply_count || 0),
      retweets: Number(item.retweets || item.retweet_count || 0),
      status: item.status || 'published'
    }));
  }

  /**
   * 解析 CSV / Excel (XLSX) 文件 Buffer
   */
  public static parseSpreadsheet(buffer: Buffer): RawPostInput[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    return rows.map(row => {
      // 兼容多种列名：Tweet text, Text, 内容, 正文, Tweet id, ID, URL, Impressions, Likes 等
      const originalText = row['Tweet text'] || row['Text'] || row['text'] || row['内容'] || row['正文'] || row['Post'] || '';
      const postId = String(row['Tweet id'] || row['Id'] || row['id'] || row['ID'] || row['帖子ID'] || '');
      const publishedAt = row['Time'] || row['created_at'] || row['时间'] || row['发布时间'] || '';
      const originalUrl = row['Tweet permalink'] || row['Url'] || row['url'] || row['链接'] || '';
      const impressions = Number(row['impressions'] || row['Impressions'] || row['展示量'] || row['曝光量'] || 0);
      const likes = Number(row['likes'] || row['Likes'] || row['点赞'] || row['点赞数'] || 0);
      const replies = Number(row['replies'] || row['Replies'] || row['回复'] || row['评论数'] || 0);
      const retweets = Number(row['retweets'] || row['Retweets'] || row['转发'] || row['转推数'] || 0);

      return {
        postId: postId || undefined,
        originalText: String(originalText),
        publishedAt: String(publishedAt),
        originalUrl: String(originalUrl),
        impressions,
        likes,
        replies,
        retweets
      };
    });
  }

  /**
   * 解析纯文本内容（支持以 --- 或多行换行分割的多篇帖子）
   */
  public static parsePlainText(text: string): RawPostInput[] {
    const parts = text.split(/(?:\r?\n){2,}---(?:\r?\n){2,}|(?:\r?\n){3,}/).map(p => p.trim()).filter(Boolean);
    return parts.map(part => ({
      originalText: part
    }));
  }
}
