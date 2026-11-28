import crypto from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { HotspotItem, StudioDraft, StudioGoalType } from '@/types';
import { OriginalityService } from '@/lib/originality/originality.service';
import { ComplianceEngineService } from '@/lib/compliance/compliance-engine.service';
import { KnowledgeImporterService } from '@/lib/knowledge/knowledge-importer.service';

export interface GenerateStudioDraftOptions {
  creatorHandle: string;
  hotspotId?: string;
  hotspotText?: string;
  hotspotTitle?: string;
  goalType: StudioGoalType;
  goalDetail?: string;
  count?: number; // 默认生成 3 个不同切角版本
}

const GOAL_INSTRUCTIONS: Record<StudioGoalType, { label: string; guide: string }> = {
  engagement: {
    label: '引导互动',
    guide: '目标是拉高评论区回复率与真实讨论：抛出一针见血的个人体验或行业争议点，留出讨论缺口，结尾用具体的二选一或开放式实操问题邀请同行留言。'
  },
  exposure: {
    label: '增加曝光',
    guide: '目标是拉高浏览量、停留与转发：首句必须有强信息增量或反差感 Hook（前 2 行直接抓住注意力），正文用短句和清晰分行提升手机端可读性，给出有共鸣或可直接收藏的洞察。'
  },
  app_validation: {
    label: '为后续做 APP 蓄水/测需求',
    guide: '目标是为将来做独立 APP 铺路与验证真实需求：绝对不要写成生硬广告！而是用 Build in Public（公开探索）口吻，从热点切入一个普通人/目标用户真实会遇到的痛点，自然探讨“如果做一个极简小工具/APP 解决这件事，大家最在意什么功能？”，收集真实反馈与潜在种子用户。'
  },
  custom: {
    label: '自定义目标',
    guide: '严格围绕用户填写的自定义目标展开表达，保持自然口语与真实感。'
  }
};

export class StudioDeskService {
  /**
   * 统一解析文本大模型配置（优先使用 DEEPSEEK_API_KEY）
   */
  public static resolveTextLlmConfig() {
    if (process.env.DEEPSEEK_API_KEY) {
      return {
        configured: true,
        provider: 'DeepSeek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
      };
    }

    const fallbackKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    if (fallbackKey) {
      return {
        configured: true,
        provider: 'OpenAI-Compatible',
        apiKey: fallbackKey,
        baseUrl: (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
        model: process.env.LLM_MODEL || 'gpt-4o-mini'
      };
    }

    return {
      configured: false,
      provider: 'unconfigured',
      apiKey: '',
      baseUrl: '',
      model: 'unconfigured'
    };
  }

  /**
   * 获取创作台顶部摘要与运行状态
   */
  public static getSummary(creatorHandle: string) {
    const db = getDb();
    const llm = this.resolveTextLlmConfig();

    const styleSamplesCount = (db.prepare(`
      SELECT count(*) as c FROM knowledge_posts WHERE creator_handle = ? AND status != 'deleted'
    `).get(creatorHandle) as { c: number }).c;

    const pendingHotspotsCount = (db.prepare(`
      SELECT count(*) as c FROM hotspot_inbox WHERE creator_handle = ? AND status = 'pending'
    `).get(creatorHandle) as { c: number }).c;

    const readyDraftsCount = (db.prepare(`
      SELECT count(*) as c FROM studio_drafts WHERE creator_handle = ? AND status != 'published'
    `).get(creatorHandle) as { c: number }).c;

    const publishedDraftsCount = (db.prepare(`
      SELECT count(*) as c FROM studio_drafts WHERE creator_handle = ? AND status = 'published'
    `).get(creatorHandle) as { c: number }).c;

    return {
      creatorHandle,
      llmConfigured: llm.configured,
      llmProvider: llm.provider,
      llmModel: llm.model,
      styleSamplesCount,
      pendingHotspotsCount,
      readyDraftsCount,
      publishedDraftsCount
    };
  }

  /**
   * 人工/他人热点一键导入解析（支持单条粘贴或用 --- / 空行分割的多条热点，自动防重）
   */
  public static importHotspots(
    creatorHandle: string,
    rawText: string,
    sourceNote = '人工/同事导入'
  ): { imported: HotspotItem[]; skippedDuplicates: number } {
    const db = getDb();
    const now = new Date().toISOString();

    const blocks = rawText
      .split(/(?:\r?\n){2,}---(?:\r?\n){2,}|(?:\r?\n){3,}/)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    const imported: HotspotItem[] = [];
    let skippedDuplicates = 0;

    const checkStmt = db.prepare(
      'SELECT id FROM hotspot_inbox WHERE creator_handle = ? AND content_hash = ?'
    );
    const insertStmt = db.prepare(`
      INSERT INTO hotspot_inbox (
        id, creator_handle, title, content, source_note, content_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    for (const block of blocks) {
      const normalized = block.replace(/\s+/g, ' ').toLowerCase();
      const contentHash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');

      const existing = checkStmt.get(creatorHandle, contentHash);
      if (existing) {
        skippedDuplicates++;
        continue;
      }

      const firstLine = block.split(/\r?\n/)[0].replace(/^[#*\-\d.\s]+/, '').trim();
      const title = (firstLine || block).slice(0, 60);
      const id = `hs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      insertStmt.run(id, creatorHandle, title, block, sourceNote.trim() || '人工导入', contentHash, now, now);

      imported.push({
        id,
        creatorHandle,
        title,
        content: block,
        sourceNote: sourceNote.trim() || '人工导入',
        status: 'pending',
        createdAt: now,
        updatedAt: now
      });
    }

    return { imported, skippedDuplicates };
  }

  public static listHotspots(creatorHandle: string): HotspotItem[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM hotspot_inbox
      WHERE creator_handle = ? AND status != 'archived'
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 50
    `).all(creatorHandle) as any[];

    return rows.map(r => ({
      id: r.id,
      creatorHandle: r.creator_handle,
      title: r.title,
      content: r.content,
      sourceNote: r.source_note,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public static deleteHotspot(id: string): boolean {
    const db = getDb();
    const res = db.prepare('DELETE FROM hotspot_inbox WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  /**
   * 抽取创作者真实历史推文作为风格范例（Few-Shot）+ 最近已发观点防重摘要
   */
  private static getCreatorStyleContext(creatorHandle: string) {
    const db = getDb();
    const samples = db.prepare(`
      SELECT original_text, impressions, likes, replies
      FROM knowledge_posts
      WHERE creator_handle = ? AND status != 'deleted'
      ORDER BY (likes * 3 + replies * 5 + impressions * 0.01) DESC, published_at DESC
      LIMIT 6
    `).all(creatorHandle) as any[];

    const recentPublished = db.prepare(`
      SELECT original_text FROM knowledge_posts
      WHERE creator_handle = ? AND status = 'published'
      ORDER BY published_at DESC
      LIMIT 10
    `).all(creatorHandle) as any[];

    return {
      styleExamples: samples.map(s => s.original_text),
      recentSummaries: recentPublished.map(r => r.original_text.slice(0, 80))
    };
  }

  /**
   * 调用真实 DeepSeek / OpenAI 兼容模型生成多版风格文案
   */
  private static async callLlmForDrafts(params: {
    hotspotTitle: string;
    hotspotContent: string;
    goalType: StudioGoalType;
    goalDetail: string;
    styleExamples: string[];
    recentSummaries: string[];
    count: number;
  }): Promise<{ drafts: Array<{ angle: string; mainText: string; firstComment: string }>; modelUsed: string } | null> {
    const llm = this.resolveTextLlmConfig();
    if (!llm.configured) return null;

    const goalMeta = GOAL_INSTRUCTIONS[params.goalType] || GOAL_INSTRUCTIONS.engagement;
    const styleSection = params.styleExamples.length > 0
      ? `以下是这位创作者真实写过的历史推文样本，请仔细模仿他的句长、语气、换行节奏和真实接地气的表达方式（不要照抄原话）：\n${params.styleExamples
          .map((t, i) => `【样本 ${i + 1}】\n${t}`)
          .join('\n\n')}`
      : '创作者暂未导入历史推文样本，请采用真诚、克制、口语化、像真人聊天一样的中文 X 推文风格，严禁出现“在这个快节奏的时代”“总而言之”“赋能”“抓手”“值得深思”等 AI 腔套话。';

    const avoidSection = params.recentSummaries.length > 0
      ? `以下是该账号近期已发布过的观点摘要，请务必避开相同角度，提供全新切入点：\n${params.recentSummaries
          .map((s, i) => `${i + 1}. ${s}`)
          .join('\n')}`
      : '';

    const systemPrompt = [
      '你是顶级的 X (Twitter) 中文创作者个人内容搭档。',
      styleSection,
      avoidSection,
      '严格规则：',
      '1. 主帖不要放外部链接（防止 X 算法限流），不要堆砌超过 2 个 #标签，不要写夸大虚假承诺。',
      '2. 输出必须是合法 JSON 对象，格式为：{"drafts":[{"angle":"切入角度简述","mainText":"推文正文","firstComment":"发布后自己抢占的第1条评论区引导语"}]}',
      `3. 必须生成恰好 ${params.count} 个截然不同切入角度的版本。`
    ].filter(Boolean).join('\n\n');

    const userPrompt = [
      `【本次热点素材】`,
      `标题：${params.hotspotTitle}`,
      `内容：${params.hotspotContent}`,
      '',
      `【本次运营目标】：${goalMeta.label}`,
      `目标指导：${goalMeta.guide}`,
      params.goalDetail ? `补充具体目标：${params.goalDetail}` : '',
      '',
      `请直接返回纯 JSON，不要包裹多余解释文字。`
    ].filter(Boolean).join('\n');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${llm.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llm.apiKey}`
        },
        body: JSON.stringify({
          model: llm.model,
          temperature: 0.78,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content?.trim();
      if (!rawContent) return null;

      const cleanedJson = rawContent.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanedJson);
      const list = Array.isArray(parsed.drafts) ? parsed.drafts : [];
      if (list.length === 0) return null;

      return {
        modelUsed: `${llm.provider} (${llm.model})`,
        drafts: list.slice(0, params.count).map((d: any, idx: number) => ({
          angle: String(d.angle || `切入角度 #${idx + 1}`),
          mainText: String(d.mainText || '').trim(),
          firstComment: String(d.firstComment || '').trim()
        })).filter((d: any) => d.mainText.length > 0)
      };
    } catch {
      return null;
    }
  }

  /**
   * 构造可直接复制到 ChatGPT 网页版的专属提示词（兼容用户用 GPT 精修的习惯）
   */
  public static buildGptBridgePrompt(params: {
    creatorHandle: string;
    hotspotTitle: string;
    hotspotContent: string;
    goalType: StudioGoalType;
    goalDetail?: string;
  }): string {
    const { styleExamples, recentSummaries } = this.getCreatorStyleContext(params.creatorHandle);
    const goalMeta = GOAL_INSTRUCTIONS[params.goalType] || GOAL_INSTRUCTIONS.engagement;

    return [
      `请帮我结合下面这个热点，写出 3 条符合我平时 X (Twitter) 账号风格的中文推文（每条附带 1 句我自己发在评论区第一条的互动引导语）：`,
      '',
      `【热点内容】`,
      `${params.hotspotTitle ? params.hotspotTitle + '\n' : ''}${params.hotspotContent}`,
      '',
      `【本次发帖目标】：${goalMeta.label}${params.goalDetail ? `（${params.goalDetail}）` : ''}`,
      `${goalMeta.guide}`,
      '',
      styleExamples.length > 0
        ? `【我的历史推文风格样本（请模仿语气、句长和节奏，不要照抄）】\n${styleExamples.slice(0, 4).map((s, i) => `样本${i + 1}：${s}`).join('\n\n')}`
        : `【风格要求】：口语化、像真人聊天、去 AI 味、不要放外链、最多 1-2 个标签。`,
      recentSummaries.length > 0
        ? `\n【近期已发过，请避开重复角度】：\n${recentSummaries.slice(0, 5).map(s => `- ${s}`).join('\n')}`
        : ''
    ].filter(Boolean).join('\n');
  }

  /**
   * 根据热点 + 目标生成多版待发文案（自动过原创性查重与合规审核）
   */
  public static async generateDrafts(options: GenerateStudioDraftOptions): Promise<{
    drafts: StudioDraft[];
    llmUsed: boolean;
    notice?: string;
    gptBridgePrompt: string;
  }> {
    const db = getDb();
    const now = new Date().toISOString();
    const count = Math.min(Math.max(options.count || 3, 1), 5);

    let hotspotTitle = (options.hotspotTitle || '').trim();
    let hotspotContent = (options.hotspotText || '').trim();
    const hotspotId = options.hotspotId;

    if (hotspotId && !hotspotContent) {
      const row = db.prepare('SELECT * FROM hotspot_inbox WHERE id = ?').get(hotspotId) as any;
      if (row) {
        hotspotTitle = row.title;
        hotspotContent = row.content;
      }
    }

    if (!hotspotContent) {
      throw new Error('请先选择一条热点或输入热点/想法内容');
    }

    if (!hotspotTitle) {
      hotspotTitle = hotspotContent.split(/\r?\n/)[0].slice(0, 50);
    }

    const goalDetail = (options.goalDetail || '').trim();
    const { styleExamples, recentSummaries } = this.getCreatorStyleContext(options.creatorHandle);

    const gptBridgePrompt = this.buildGptBridgePrompt({
      creatorHandle: options.creatorHandle,
      hotspotTitle,
      hotspotContent,
      goalType: options.goalType,
      goalDetail
    });

    const llmResponse = await this.callLlmForDrafts({
      hotspotTitle,
      hotspotContent,
      goalType: options.goalType,
      goalDetail,
      styleExamples,
      recentSummaries,
      count
    });

    const goalMeta = GOAL_INSTRUCTIONS[options.goalType] || GOAL_INSTRUCTIONS.engagement;
    let rawDrafts: Array<{ angle: string; mainText: string; firstComment: string }>;
    let modelUsed = 'unconfigured';
    let notice: string | undefined;

    if (llmResponse && llmResponse.drafts.length > 0) {
      rawDrafts = llmResponse.drafts;
      modelUsed = llmResponse.modelUsed;
    } else {
      notice = '尚未在服务端 .env.local 配置 DEEPSEEK_API_KEY（或模型请求失败）。以下为基于你选定目标生成的结构化待润色骨架；填入 DEEPSEEK_API_KEY 后将自动按你的风格直接出成品，也可点击“复制专属 Prompt 去 GPT”。';
      const fallbackAngles = [
        `${goalMeta.label} · 个人真实视角切入`,
        `${goalMeta.label} · 反常识痛点拆解`,
        `${goalMeta.label} · 互动提问与需求验证`
      ];
      rawDrafts = Array.from({ length: count }).map((_, idx) => ({
        angle: fallbackAngles[idx % fallbackAngles.length],
        mainText: [
          `【待润色草稿 #${idx + 1}｜目标：${goalMeta.label}】`,
          `热点切入：${hotspotTitle}`,
          goalDetail ? `聚焦方向：${goalDetail}` : '',
          '',
          `1. 先抛个人第一反应：这件事最值得注意的其实是背后的用户痛点。`,
          `2. 结合你的真实经历补充 2 句具体细节或判断。`,
          options.goalType === 'app_validation'
            ? `3. 需求试探：如果做一个极简小工具/APP 专门解决这个卡点，你最希望它帮你省掉哪一步？`
            : `3. 互动收尾：你平时遇到这种情况一般怎么处理？评论区聊聊。`
        ].filter(Boolean).join('\n'),
        firstComment: options.goalType === 'app_validation'
          ? '我最近也在顺手整理这类痛点，想听听大家最真实的吐槽，点赞最高的痛点我先做个极简原型试试。'
          : '顺手问一句，你是偏向保守观望还是直接上手实测的那一派？'
      }));
    }

    const insertStmt = db.prepare(`
      INSERT INTO studio_drafts (
        id, creator_handle, hotspot_id, hotspot_title, goal_type, goal_detail,
        angle, main_text, first_comment, originality_score, originality_status,
        compliance_status, compliance_notes, model_used, status,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, 'ready',
        ?, ?
      )
    `);

    const savedDrafts: StudioDraft[] = [];

    for (const item of rawDrafts) {
      const id = `sd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const orig = await OriginalityService.auditContent({
        creatorHandle: options.creatorHandle,
        text: item.mainText
      });
      const comp = ComplianceEngineService.auditContent({
        text: item.mainText,
        creatorHandle: options.creatorHandle
      });

      const originalityScore = 100 - orig.duplicateScore;
      const originalityStatus = orig.isOriginal ? 'passed' : 'flagged';
      const complianceNotes = comp.violations.map(v => `${v.ruleName}: ${v.explanation}`);

      insertStmt.run(
        id,
        options.creatorHandle,
        hotspotId || null,
        hotspotTitle,
        options.goalType,
        goalDetail,
        item.angle,
        item.mainText,
        item.firstComment,
        originalityScore,
        originalityStatus,
        comp.status,
        JSON.stringify(complianceNotes),
        modelUsed,
        now,
        now
      );

      savedDrafts.push({
        id,
        creatorHandle: options.creatorHandle,
        hotspotId,
        hotspotTitle,
        goalType: options.goalType,
        goalDetail,
        angle: item.angle,
        mainText: item.mainText,
        firstComment: item.firstComment,
        originalityScore,
        originalityStatus,
        complianceStatus: comp.status,
        complianceNotes,
        modelUsed,
        status: 'ready',
        createdAt: now,
        updatedAt: now
      });
    }

    return {
      drafts: savedDrafts,
      llmUsed: Boolean(llmResponse),
      notice,
      gptBridgePrompt
    };
  }

  /**
   * 列出当前账号的待发文案与已发布记录
   */
  public static listDrafts(creatorHandle: string, filterStatus?: 'ready' | 'published'): StudioDraft[] {
    const db = getDb();
    let sql = 'SELECT * FROM studio_drafts WHERE creator_handle = ?';
    const params: any[] = [creatorHandle];

    if (filterStatus === 'published') {
      sql += " AND status = 'published'";
    } else if (filterStatus === 'ready') {
      sql += " AND status != 'published'";
    }

    sql += ' ORDER BY created_at DESC LIMIT 60';
    const rows = db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      creatorHandle: r.creator_handle,
      hotspotId: r.hotspot_id || undefined,
      hotspotTitle: r.hotspot_title,
      goalType: r.goal_type,
      goalDetail: r.goal_detail,
      angle: r.angle,
      mainText: r.main_text,
      firstComment: r.first_comment,
      originalityScore: r.originality_score,
      originalityStatus: r.originality_status,
      complianceStatus: r.compliance_status,
      complianceNotes: JSON.parse(r.compliance_notes || '[]'),
      modelUsed: r.model_used,
      status: r.status,
      copiedAt: r.copied_at || undefined,
      publishedAt: r.published_at || undefined,
      publishedUrl: r.published_url || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * 标记已复制或已发布；标记“已发布”时自动写入 knowledge_posts 知识库防重！
   */
  public static markDraftAction(
    draftId: string,
    action: 'copy' | 'publish' | 'unpublish',
    publishedUrl?: string
  ): StudioDraft | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM studio_drafts WHERE id = ?').get(draftId) as any;
    if (!row) return null;

    const now = new Date().toISOString();

    if (action === 'copy') {
      const nextStatus = row.status === 'published' ? 'published' : 'copied';
      db.prepare(`
        UPDATE studio_drafts SET status = ?, copied_at = ?, updated_at = ? WHERE id = ?
      `).run(nextStatus, now, now, draftId);
    } else if (action === 'publish') {
      if (row.compliance_status === 'BLOCKED') {
        throw new Error('该文案已被合规引擎标记为高风险 (BLOCKED)，禁止标记发布');
      }

      db.prepare(`
        UPDATE studio_drafts
        SET status = 'published', published_at = ?, published_url = ?, updated_at = ?
        WHERE id = ?
      `).run(now, (publishedUrl || '').trim(), now, draftId);

      // 若关联了热点，标记热点为已使用
      if (row.hotspot_id) {
        db.prepare(`UPDATE hotspot_inbox SET status = 'used', updated_at = ? WHERE id = ?`).run(now, row.hotspot_id);
      }

      // 关键闭环：自动同步写入长期知识库 knowledge_posts，后续生成与查重自动避开！
      KnowledgeImporterService.importPosts(
        row.creator_handle,
        [{
          postId: `studio_${draftId}`,
          originalText: row.main_text,
          publishedAt: now,
          originalUrl: (publishedUrl || '').trim(),
          theme: row.hotspot_title || row.angle,
          status: 'published'
        }],
        'manual'
      );
    } else if (action === 'unpublish') {
      db.prepare(`
        UPDATE studio_drafts SET status = 'ready', published_at = NULL, updated_at = ? WHERE id = ?
      `).run(now, draftId);
    }

    const updated = db.prepare('SELECT * FROM studio_drafts WHERE id = ?').get(draftId) as any;
    return {
      id: updated.id,
      creatorHandle: updated.creator_handle,
      hotspotId: updated.hotspot_id || undefined,
      hotspotTitle: updated.hotspot_title,
      goalType: updated.goal_type,
      goalDetail: updated.goal_detail,
      angle: updated.angle,
      mainText: updated.main_text,
      firstComment: updated.first_comment,
      originalityScore: updated.originality_score,
      originalityStatus: updated.originality_status,
      complianceStatus: updated.compliance_status,
      complianceNotes: JSON.parse(updated.compliance_notes || '[]'),
      modelUsed: updated.model_used,
      status: updated.status,
      copiedAt: updated.copied_at || undefined,
      publishedAt: updated.published_at || undefined,
      publishedUrl: updated.published_url || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    };
  }

  public static deleteDraft(draftId: string): boolean {
    const db = getDb();
    const res = db.prepare('DELETE FROM studio_drafts WHERE id = ?').run(draftId);
    return Number(res.changes) > 0;
  }
}
