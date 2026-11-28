import { describe, it, expect, beforeEach } from 'vitest';
import { StudioDeskService } from '../src/lib/studio/studio-desk.service';
import { KnowledgeImporterService } from '../src/lib/knowledge/knowledge-importer.service';
import { OriginalityService } from '../src/lib/originality/originality.service';
import { getDb } from '../src/lib/db/client';

describe('今日创作台（热点一键导入 -> 目标生成 -> 复制与发布防重闭环）', () => {
  const handle = '@desk_test_creator';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM studio_drafts WHERE creator_handle = ?').run(handle);
    db.prepare('DELETE FROM hotspot_inbox WHERE creator_handle = ?').run(handle);
    db.prepare('DELETE FROM knowledge_posts WHERE creator_handle = ?').run(handle);
    db.prepare('DELETE FROM creators WHERE handle = ?').run(handle);
  });

  it('1. 支持一次粘贴多条热点（---分隔）并自动去重', () => {
    const raw = `
AI 编程工具价格战打响，独立开发者成本降到几乎为零

---

越来越多一人团队用小而美的工具 APP 做到月入过万美金
    `;

    const res1 = StudioDeskService.importHotspots(handle, raw, '同事搜集');
    expect(res1.imported.length).toBe(2);
    expect(res1.skippedDuplicates).toBe(0);

    // 再次导入相同内容应自动跳过
    const res2 = StudioDeskService.importHotspots(handle, raw, '同事搜集');
    expect(res2.imported.length).toBe(0);
    expect(res2.skippedDuplicates).toBe(2);
  });

  it('2. 结合历史风格样本与 APP 蓄水目标生成 3 版文案，并生成 GPT 桥接 Prompt', async () => {
    // 录入 1 条真实历史风格样本
    KnowledgeImporterService.importPosts(handle, [{
      postId: 'style_1',
      originalText: '今天踩了个大坑，做工具千万别一上来就写复杂后台，先拿最简版本给 5 个人用。'
    }], 'manual');

    const hs = StudioDeskService.importHotspots(
      handle,
      '很多 X 创作者吐槽每天写推文容易和自己以前发过的内容撞车',
      'Grok 总结'
    ).imported[0];

    const oldDs = process.env.DEEPSEEK_API_KEY;
    const oldLlm = process.env.LLM_API_KEY;
    const oldOpenAi = process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const generated = await StudioDeskService.generateDrafts({
        creatorHandle: handle,
        hotspotId: hs.id,
        goalType: 'app_validation',
        goalDetail: '试探大家是否需要一个轻量防重创作小工具',
        count: 3
      });

      expect(generated.drafts.length).toBe(3);
      expect(generated.llmUsed).toBe(false);
      expect(generated.notice).toContain('DEEPSEEK_API_KEY');
      expect(generated.gptBridgePrompt).toContain('我的历史推文风格样本');
      expect(generated.gptBridgePrompt).toContain('为后续做 APP 蓄水/测需求');
      expect(generated.drafts[0].firstComment.length).toBeGreaterThan(0);
    } finally {
      if (oldDs) process.env.DEEPSEEK_API_KEY = oldDs;
      if (oldLlm) process.env.LLM_API_KEY = oldLlm;
      if (oldOpenAi) process.env.OPENAI_API_KEY = oldOpenAi;
    }
  });

  it('3. 一键复制记账 + 标记已发后自动同步写入知识库防重并标记热点已用', async () => {
    const hs = StudioDeskService.importHotspots(handle, '测试热点：独立开发者如何冷启动第一批用户', '同事').imported[0];
    const { drafts } = await StudioDeskService.generateDrafts({
      creatorHandle: handle,
      hotspotId: hs.id,
      goalType: 'engagement',
      count: 1
    });

    const draft = drafts[0];

    // 标记已复制
    const copied = StudioDeskService.markDraftAction(draft.id, 'copy');
    expect(copied?.status).toBe('copied');
    expect(copied?.copiedAt).toBeDefined();

    // 标记已发布
    const published = StudioDeskService.markDraftAction(draft.id, 'publish', 'https://x.com/test/status/999');
    expect(published?.status).toBe('published');
    expect(published?.publishedAt).toBeDefined();

    // 验证关联热点已被标记为 used
    const updatedHotspots = StudioDeskService.listHotspots(handle);
    expect(updatedHotspots[0].status).toBe('used');

    // 验证自动同步写入知识库后，再次拿相同内容查重会被精准拦截！
    const audit = await OriginalityService.auditContent({
      creatorHandle: handle,
      text: draft.mainText
    });
    expect(audit.isOriginal).toBe(false);
    expect(audit.duplicateScore).toBe(100);
  });
});
