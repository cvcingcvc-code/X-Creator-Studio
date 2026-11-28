import { getDb } from '@/lib/db/client';
import { CreationBatch, GenerationItem, BatchCount } from '@/types';
import { SearchOrchestratorService } from '@/lib/search/search-orchestrator.service';
import { OriginalityService } from '@/lib/originality/originality.service';
import { ComplianceEngineService } from '@/lib/compliance/compliance-engine.service';

export interface CreateBatchOptions {
  creatorHandle: string;
  count: BatchCount; // 1 | 5 | 10 | 20
  customTopic?: string;
  textModel?: string;
  imageModel?: string;
}

export interface UpdateItemInput {
  generatedText?: string;
  imageUrl?: string;
  topic?: string;
  angle?: string;
}

export class CreationFactoryService {
  public static getModelRuntimeStatus() {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const llmKey = deepseekKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    const imageKey = process.env.IMAGE_API_KEY;
    return {
      textApiConfigured: Boolean(llmKey),
      textModel: deepseekKey
        ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
        : (llmKey ? (process.env.LLM_MODEL || 'gpt-4o-mini') : 'unconfigured'),
      textBaseUrl: deepseekKey
        ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
        : (process.env.LLM_BASE_URL || 'https://api.openai.com/v1'),
      imageApiConfigured: Boolean(imageKey),
      imageModel: imageKey ? (process.env.IMAGE_MODEL || 'dall-e-3') : 'unconfigured',
      imageBaseUrl: process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1'
    };
  }

  /**
   * 真实调用 OpenAI / DeepSeek 兼容文本模型接口；未配置或调用失败时返回 null，绝不伪造成功调用
   */
  private static async generateCopyWithRealLlm(params: {
    topic: string;
    angle: string;
    sourceSummary: string;
    toneStyle: string;
    model: string;
  }): Promise<{ text: string; tokens: number } | null> {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const apiKey = deepseekKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const baseUrl = (
      deepseekKey
        ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
        : (process.env.LLM_BASE_URL || 'https://api.openai.com/v1')
    ).replace(/\/$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: params.model,
          temperature: 0.75,
          messages: [
            {
              role: 'system',
              content: `你是专业的 X (Twitter) 内容创作助手。风格要求：${params.toneStyle}。严格遵守原创性与平台合规要求，不使用夸张营销词汇，不堆砌超过 2 个标签。`
            },
            {
              role: 'user',
              content: `请围绕选题「${params.topic}」，从视角「${params.angle}」撰写 1 条中文 X 推文。参考真实信源：${params.sourceSummary}。结尾附带 1 个开放式互动提问。`
            }
          ]
        })
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) return null;
      const tokens = Number(data.usage?.total_tokens || Math.ceil(text.length * 1.5));
      return { text, tokens };
    } catch {
      return null;
    }
  }

  /**
   * 真实调用生图 API；未配置或失败时返回 undefined，严格禁止使用假图片冒充真实生图
   */
  private static async generateImageWithRealApi(
    prompt: string,
    model: string
  ): Promise<string | undefined> {
    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return undefined;

    const baseUrl = (process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: '1024x1024'
        })
      });
      clearTimeout(timeout);

      if (!res.ok) return undefined;
      const data = await res.json();
      const first = data.data?.[0];
      if (first?.url) return String(first.url);
      if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 启动批量图文创作工序
   */
  public static async startBatchCreation(options: CreateBatchOptions): Promise<CreationBatch> {
    const db = getDb();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const runtime = this.getModelRuntimeStatus();
    const textModel = options.textModel || runtime.textModel;
    const imageModel = options.imageModel || runtime.imageModel;

    const providerNotices: string[] = [];
    if (!runtime.textApiConfigured) {
      providerNotices.push(
        '未配置服务端文字模型 API Key (LLM_API_KEY)。当前输出基于真实联网信源组装的结构化选题草稿骨架，请人工编辑完善或在服务端配置 LLM_API_KEY。'
      );
    }
    if (!runtime.imageApiConfigured) {
      providerNotices.push(
        '未配置服务端生图模型 API Key (IMAGE_API_KEY)。系统仅输出配图设计提示词并开放人工素材上传，绝不使用假图片冒充真实生图。'
      );
    }

    // 1. 初始化批次记录
    db.prepare(`
      INSERT INTO creation_batches (
        id, creator_handle, batch_count, status, progress,
        text_model, image_model, total_tokens_used, estimated_cost_usd,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchId,
      options.creatorHandle,
      options.count,
      'running',
      10,
      textModel,
      imageModel,
      0,
      0,
      now,
      now
    );

    // 2. 真实联网检索灵感基底
    const searchQuery = options.customTopic || 'AI agent open source';
    const searchResult = await SearchOrchestratorService.executeSearch(searchQuery, {
      limit: Math.max(options.count * 2, 10),
      enabledProviders: ['github', 'hackernews', 'rss', 'web_search']
    });

    // 3. 检索创作者已有知识库偏好
    const creator = db.prepare('SELECT * FROM creators WHERE handle = ?').get(options.creatorHandle) as any;
    const toneStyle = creator?.tone_style || '真诚务实、结构清晰、立足真实经验与可验证数据';

    const items: GenerationItem[] = [];
    let totalTokens = 0;

    // 4. 为每个批次槽位生成具有鲜明差异化的独立选题与内容
    for (let i = 0; i < options.count; i++) {
      const itemId = `item_${batchId}_${i + 1}`;
      const searchRef = searchResult.items.length > 0
        ? searchResult.items[i % searchResult.items.length]
        : undefined;
      const topicTitle = this.synthesizeTopic(i, searchRef, options.customTopic);
      const angle = this.synthesizeAngle(i);

      // 设计配图提示词
      const imagePrompt = `Minimalist editorial infographic card visualizing "${topicTitle}", angle: "${angle}", clean grid layout, high contrast typography, cool slate & cyan palette, 16:9`;

      // 若配置了真实生图 API 则请求真实接口，否则保持空并标注等待人工上传
      let imageUrl: string | undefined;
      let imageSource: 'api_generated' | 'manual_uploaded' | 'unconfigured' = 'unconfigured';
      if (runtime.imageApiConfigured) {
        imageUrl = await this.generateImageWithRealApi(imagePrompt, imageModel);
        if (imageUrl) {
          imageSource = 'api_generated';
        }
      }

      // 若配置了真实文字大模型 API 则真实调用，否则诚实组装基于真实检索源的草稿骨架
      let generatedText: string;
      const llmResult = runtime.textApiConfigured
        ? await this.generateCopyWithRealLlm({
            topic: topicTitle,
            angle,
            sourceSummary: searchRef ? `${searchRef.title} (${searchRef.source} - ${searchRef.url})` : '无外部信源',
            toneStyle,
            model: textModel
          })
        : null;

      if (llmResult) {
        generatedText = llmResult.text;
        totalTokens += llmResult.tokens;
      } else {
        generatedText = this.synthesizeDraftOutline(topicTitle, angle, searchRef, i);
      }

      // 真实原创性检测（与历史库查重 + 同批次内交叉查重 + 图片感知哈希）
      const originalityAudit = await OriginalityService.auditContent({
        id: itemId,
        creatorHandle: options.creatorHandle,
        text: generatedText,
        imageUrl,
        batchId
      });

      // 合规审核
      const complianceAudit = ComplianceEngineService.auditContent({
        text: generatedText,
        creatorHandle: options.creatorHandle
      });

      const item: GenerationItem = {
        id: itemId,
        batchId,
        topic: topicTitle,
        angle,
        imagePrompt,
        imageUrl,
        imageSource,
        generatedText,
        originalityScore: 100 - originalityAudit.duplicateScore,
        originalityStatus: originalityAudit.isOriginal ? 'passed' : 'flagged',
        originalityReasons: originalityAudit.reasons,
        complianceStatus: complianceAudit.status,
        complianceViolations: complianceAudit.violations.map((v: any) => `${v.ruleName}: ${v.explanation}`),
        sources: searchRef ? [{
          title: searchRef.title,
          url: searchRef.url,
          source: searchRef.source
        }] : [],
        status: complianceAudit.status === 'BLOCKED' ? 'blocked' : 'ready_for_review',
        isConfirmed: false
      };

      db.prepare(`
        INSERT INTO generation_items (
          id, batch_id, sequence_no, title, angle, image_prompt,
          image_url, image_source, generated_text, originality_score, originality_status,
          originality_reasons, compliance_status, compliance_violations,
          sources, status, is_confirmed, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(
        item.id,
        item.batchId,
        i + 1,
        item.topic,
        item.angle,
        item.imagePrompt,
        item.imageUrl || null,
        item.imageSource || 'unconfigured',
        item.generatedText,
        item.originalityScore,
        item.originalityStatus,
        JSON.stringify(item.originalityReasons || []),
        item.complianceStatus,
        JSON.stringify(item.complianceViolations || []),
        JSON.stringify(item.sources),
        item.status,
        0,
        now,
        now
      );

      items.push(item);
    }

    const estimatedCostUsd = runtime.textApiConfigured
      ? Number(((totalTokens / 1000) * 0.002 + (runtime.imageApiConfigured ? options.count * 0.04 : 0)).toFixed(4))
      : 0;

    // 5. 更新批次总体进度、Token 与真实成本
    db.prepare(`
      UPDATE creation_batches
      SET status = 'completed', progress = 100, total_tokens_used = ?, estimated_cost_usd = ?, updated_at = ?
      WHERE id = ?
    `).run(totalTokens, estimatedCostUsd, new Date().toISOString(), batchId);

    return {
      id: batchId,
      creatorHandle: options.creatorHandle,
      batchCount: options.count,
      status: 'completed',
      progress: 100,
      textModel,
      imageModel,
      textApiConfigured: runtime.textApiConfigured,
      imageApiConfigured: runtime.imageApiConfigured,
      providerNotices,
      totalTokensUsed: totalTokens,
      estimatedCostUsd,
      items,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 针对不同序号生成独立差异化的主题（覆盖最多 20 组不重复切角）
   */
  private static synthesizeTopic(index: number, ref?: any, customTopic?: string): string {
    const base = customTopic || (ref?.title ? ref.title.slice(0, 45) : 'AI 工具落地与独立产品实践');
    const angles = [
      '【实操踩坑】冷启动阶段最容易忽视的架构短板',
      '【工程落地】从原型验证到稳定交付的关键重构步骤',
      '【数据复盘】单人交付周期与转化效率对比拆解',
      '【分发观察】互动权重与读者共鸣点的结构实验',
      '【反常识视角】停止无效功能堆砌，先验证真实需求',
      '【成本账本】云端部署、API 消耗与边界利润测算',
      '【自动化边界】哪些环节该交给脚本，哪些必须人工把关',
      '【开源借力】如何评估并二次封装高 Star 开源项目',
      '【用户访谈】从第一批差评中提炼的产品迭代清单',
      '【长尾流量】把一次讨论沉淀为可持续复用的知识资产',
      '【风控底线】账号合规、版权溯源与防封号自查表',
      '【工具选型】轻量方案与重型框架的真实维护成本差',
      '【场景细分】为什么垂类工作流比通用壳产品更有壁垒',
      '【失败样本】复盘一次没有跑通商业闭环的真实实验',
      '【效率对比】传统研发与 AI 协同在测试与排错上的差距',
      '【信息降噪】如何构建高信噪比的日常科技情报雷达',
      '【冷启动增长】不买量、不刷粉的真实社区口碑打法',
      '【内容矩阵】同一核心洞察如何改写为不同受众视角',
      '【版本演进】小步快跑 vs 闷头打磨的真实反馈对比',
      '【年度沉淀】个人创作者数字资产的复利飞轮拆解'
    ];
    return `${base} · ${angles[index % angles.length]}`;
  }

  private static synthesizeAngle(index: number): string {
    const angleList = [
      '第一人称真实踩坑复盘与止损经验',
      '量化指标对比：自动化前后的时间与成本差',
      '可执行 SOP 清单：分步骤拆解核心判断标准',
      '反常识设问：直击行业误区引发评论区讨论',
      '商业闭环视角：聚焦真实痛点与用户反馈',
      '架构权衡视角：对比不同技术选型的隐性代价',
      '风控与长期主义视角：强调可验证来源与合规边界',
      '案例解剖视角：结合最新开源趋势拆解落地路径',
      '读者共创视角：公开草稿与取舍过程征求同行意见',
      '复利资产视角：把单次经验沉淀为长期知识节点'
    ];
    return `${angleList[index % angleList.length]}（批次视角 #${index + 1}）`;
  }

  private static synthesizeDraftOutline(
    topic: string,
    angle: string,
    ref: any,
    index: number
  ): string {
    const cleanBase = topic.split('·')[0].trim();
    const refLine = ref
      ? `真实信源参考：${ref.title.slice(0, 60)}（来源：${ref.source}）`
      : '建议补充 1 条可验证的一手来源或实验记录。';

    return [
      `【待润色草稿 #${index + 1}】关于「${cleanBase}」的切入观察`,
      '',
      `核心视角：${angle}`,
      `${refLine}`,
      '',
      `要点提纲：`,
      `1. 背景与痛点：说明为什么当前阶段这个问题值得重新审视。`,
      `2. 实操发现：补充你的第一手数据、踩坑记录或具体对比结论。`,
      `3. 结论边界：明确适用条件与潜在局限，不做绝对化承诺。`,
      '',
      `互动引导：你在推进类似实践时，遇到的最大阻力是什么？欢迎在评论区交流。`
    ].join('\n');
  }

  /**
   * 编辑单个生成项（支持修改文案、绑定人工上传配图，并自动重跑原创性+合规双审核）
   */
  public static async updateItem(
    batchId: string,
    itemId: string,
    patch: UpdateItemInput
  ): Promise<GenerationItem | null> {
    const db = getDb();
    const item = db.prepare('SELECT * FROM generation_items WHERE id = ? AND batch_id = ?').get(itemId, batchId) as any;
    if (!item) return null;

    const batch = db.prepare('SELECT * FROM creation_batches WHERE id = ?').get(batchId) as any;
    const creatorHandle = batch?.creator_handle || '@creator';
    const nextTopic = patch.topic !== undefined ? patch.topic.trim() : item.title;
    const nextAngle = patch.angle !== undefined ? patch.angle.trim() : item.angle;
    const nextText = patch.generatedText !== undefined ? patch.generatedText : item.generated_text;
    const nextImageUrl = patch.imageUrl !== undefined ? (patch.imageUrl.trim() || null) : item.image_url;

    const origAudit = await OriginalityService.auditContent({
      id: itemId,
      creatorHandle,
      text: nextText,
      imageUrl: nextImageUrl || undefined,
      batchId
    });

    const compAudit = ComplianceEngineService.auditContent({
      text: nextText,
      creatorHandle
    });

    const now = new Date().toISOString();
    const nextStatus = compAudit.status === 'BLOCKED' ? 'blocked' : 'ready_for_review';

    const nextImageSource: 'api_generated' | 'manual_uploaded' | 'unconfigured' =
      patch.imageUrl !== undefined
        ? (nextImageUrl ? 'manual_uploaded' : 'unconfigured')
        : (item.image_source || (nextImageUrl ? 'manual_uploaded' : 'unconfigured'));

    db.prepare(`
      UPDATE generation_items
      SET title = ?, angle = ?, generated_text = ?, image_url = ?, image_source = ?,
          originality_score = ?, originality_status = ?, originality_reasons = ?,
          compliance_status = ?, compliance_violations = ?,
          status = ?, is_confirmed = 0, updated_at = ?
      WHERE id = ?
    `).run(
      nextTopic,
      nextAngle,
      nextText,
      nextImageUrl,
      nextImageSource,
      100 - origAudit.duplicateScore,
      origAudit.isOriginal ? 'passed' : 'flagged',
      JSON.stringify(origAudit.reasons),
      compAudit.status,
      JSON.stringify(compAudit.violations.map((v: any) => `${v.ruleName}: ${v.explanation}`)),
      nextStatus,
      now,
      itemId
    );

    return {
      id: itemId,
      batchId,
      topic: nextTopic,
      angle: nextAngle,
      imagePrompt: item.image_prompt,
      imageUrl: nextImageUrl || undefined,
      imageSource: nextImageSource,
      generatedText: nextText,
      originalityScore: 100 - origAudit.duplicateScore,
      originalityStatus: origAudit.isOriginal ? 'passed' : 'flagged',
      originalityReasons: origAudit.reasons,
      complianceStatus: compAudit.status,
      complianceViolations: compAudit.violations.map((v: any) => `${v.ruleName}: ${v.explanation}`),
      sources: JSON.parse(item.sources || '[]'),
      status: nextStatus,
      isConfirmed: false
    };
  }

  /**
   * 暂停或恢复批次状态
   */
  public static updateBatchStatus(
    batchId: string,
    status: 'paused' | 'running' | 'completed'
  ): { id: string; status: string; updatedAt: string } | null {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM creation_batches WHERE id = ?').get(batchId);
    if (!existing) return null;

    const now = new Date().toISOString();
    db.prepare('UPDATE creation_batches SET status = ?, updated_at = ? WHERE id = ?').run(status, now, batchId);
    return { id: batchId, status, updatedAt: now };
  }

  /**
   * 重新生成单个项目
   */
  public static async regenerateItem(batchId: string, itemId: string): Promise<GenerationItem | null> {
    const db = getDb();
    const item = db.prepare('SELECT * FROM generation_items WHERE id = ? AND batch_id = ?').get(itemId, batchId) as any;
    if (!item) return null;

    const batch = db.prepare('SELECT * FROM creation_batches WHERE id = ?').get(batchId) as any;
    const creatorHandle = batch?.creator_handle || '@creator';
    const runtime = this.getModelRuntimeStatus();
    const now = new Date().toISOString();

    const newAngle = `【重构视角 #${Date.now() % 1000}】从反面风险、边界条件与落地参数的深度剖析`;
    const baseTopic = item.title.split('·')[0].trim();

    let newText: string;
    const llmResult = runtime.textApiConfigured
      ? await this.generateCopyWithRealLlm({
          topic: baseTopic,
          angle: newAngle,
          sourceSummary: item.sources || '无额外信源',
          toneStyle: '客观犀利、基于一手参数复盘',
          model: batch?.text_model || runtime.textModel
        })
      : null;

    if (llmResult) {
      newText = llmResult.text;
    } else {
      newText = [
        `【重构草稿】换个角度看「${baseTopic}」：`,
        '',
        `多数讨论只看理想效果，但实际落地最容易踩坑的往往是这 2 个隐藏条件：`,
        `• 容错边界：单点接口失败或限流时，流程是否能够优雅降级而非伪造结果`,
        `• 真实产出比：每一项投入是否对应可复盘的数据指标`,
        '',
        `你在实操中遇到过哪些被低估的隐性卡点？欢迎分享你的踩坑记录。`
      ].join('\n');
    }

    const origAudit = await OriginalityService.auditContent({
      id: itemId,
      creatorHandle,
      text: newText,
      imageUrl: item.image_url || undefined,
      batchId
    });

    const compAudit = ComplianceEngineService.auditContent({
      text: newText,
      creatorHandle
    });

    const nextStatus = compAudit.status === 'BLOCKED' ? 'blocked' : 'ready_for_review';

    db.prepare(`
      UPDATE generation_items
      SET angle = ?, generated_text = ?, originality_score = ?,
          originality_status = ?, originality_reasons = ?,
          compliance_status = ?, compliance_violations = ?,
          status = ?, is_confirmed = 0, updated_at = ?
      WHERE id = ?
    `).run(
      newAngle,
      newText,
      100 - origAudit.duplicateScore,
      origAudit.isOriginal ? 'passed' : 'flagged',
      JSON.stringify(origAudit.reasons),
      compAudit.status,
      JSON.stringify(compAudit.violations.map((v: any) => `${v.ruleName}: ${v.explanation}`)),
      nextStatus,
      now,
      itemId
    );

    return {
      id: itemId,
      batchId,
      topic: item.title,
      angle: newAngle,
      imagePrompt: item.image_prompt,
      imageUrl: item.image_url || undefined,
      imageSource: item.image_source || (item.image_url ? 'manual_uploaded' : 'unconfigured'),
      generatedText: newText,
      originalityScore: 100 - origAudit.duplicateScore,
      originalityStatus: origAudit.isOriginal ? 'passed' : 'flagged',
      originalityReasons: origAudit.reasons,
      complianceStatus: compAudit.status,
      complianceViolations: compAudit.violations.map((v: any) => `${v.ruleName}: ${v.explanation}`),
      sources: JSON.parse(item.sources || '[]'),
      status: nextStatus,
      isConfirmed: false
    };
  }

  /**
   * 创作者人工确认并生成发布 Intent 链接
   */
  public static confirmItem(batchId: string, itemId: string): { confirmed: boolean; webIntentUrl: string; text: string } {
    const db = getDb();
    const item = db.prepare('SELECT * FROM generation_items WHERE id = ? AND batch_id = ?').get(itemId, batchId) as any;
    if (!item) throw new Error('未找到该创作项');

    if (item.compliance_status === 'BLOCKED') {
      throw new Error('高风险违规内容已被合规引擎阻止发布，禁止进入发布通道！');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE generation_items 
      SET is_confirmed = 1, status = 'confirmed', updated_at = ? 
      WHERE id = ?
    `).run(now, itemId);

    // 使用 X 合规公开 Web Intent，绝非任何自动化刷帖脚本
    const encodedText = encodeURIComponent(item.generated_text);
    const webIntentUrl = `https://x.com/intent/tweet?text=${encodedText}`;

    return {
      confirmed: true,
      webIntentUrl,
      text: item.generated_text
    };
  }
}
