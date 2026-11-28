import { describe, it, expect, beforeEach } from 'vitest';
import { CreationFactoryService } from '../src/lib/factory/creation-factory.service';
import { getDb } from '../src/lib/db/client';

describe('批量图文创作工厂系统', () => {
  const testHandle = '@factory_test_creator';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM generation_items').run();
    db.prepare('DELETE FROM creation_batches').run();
    db.prepare('DELETE FROM creators WHERE handle = ?').run(testHandle);
  });

  it('1. 支持 5 组独立批次生成，未配置生图/文本 API 时明确提示且绝不伪造假图或虚假成本', async () => {
    const oldLlm = process.env.LLM_API_KEY;
    const oldOpenAi = process.env.OPENAI_API_KEY;
    const oldImg = process.env.IMAGE_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.IMAGE_API_KEY;

    try {
      const batch = await CreationFactoryService.startBatchCreation({
        creatorHandle: testHandle,
        count: 5,
        customTopic: '开源 AI Agent 架构演进'
      });

      expect(batch.batchCount).toBe(5);
      expect(batch.items.length).toBe(5);
      expect(batch.status).toBe('completed');
      expect(batch.textApiConfigured).toBe(false);
      expect(batch.imageApiConfigured).toBe(false);
      expect(batch.providerNotices?.length).toBeGreaterThanOrEqual(2);
      expect(batch.estimatedCostUsd).toBe(0);

      // 严禁伪造图片
      for (const item of batch.items) {
        expect(item.imageUrl).toBeUndefined();
        expect(item.imageSource).toBe('unconfigured');
      }

      // 检查选题与切入角度独立性
      const topics = new Set(batch.items.map(it => it.topic));
      const angles = new Set(batch.items.map(it => it.angle));
      expect(topics.size).toBe(5);
      expect(angles.size).toBe(5);
    } finally {
      if (oldLlm) process.env.LLM_API_KEY = oldLlm;
      if (oldOpenAi) process.env.OPENAI_API_KEY = oldOpenAi;
      if (oldImg) process.env.IMAGE_API_KEY = oldImg;
    }
  });

  it('2. 支持单条重新生成、编辑重审与批次暂停恢复', async () => {
    const batch = await CreationFactoryService.startBatchCreation({
      creatorHandle: testHandle,
      count: 1,
      customTopic: '测试单条重试与编辑'
    });

    const firstItem = batch.items[0];
    const regenerated = await CreationFactoryService.regenerateItem(batch.id, firstItem.id);
    expect(regenerated).toBeDefined();
    expect(regenerated?.generatedText).not.toBe(firstItem.generatedText);

    // 编辑改为包含隐私手机号的内容，应自动复审并拦截
    const edited = await CreationFactoryService.updateItem(batch.id, firstItem.id, {
      generatedText: '测试联系手机 13800138000 稳赚不赔'
    });
    expect(edited?.complianceStatus).toBe('BLOCKED');
    expect(edited?.status).toBe('blocked');

    // 暂停与恢复批次
    const paused = CreationFactoryService.updateBatchStatus(batch.id, 'paused');
    expect(paused?.status).toBe('paused');
    const resumed = CreationFactoryService.updateBatchStatus(batch.id, 'completed');
    expect(resumed?.status).toBe('completed');
  });

  it('3. 人工确认后方可导出发推，合规阻止的内容严禁进入发布', () => {
    const db = getDb();
    const batchId = 'test_batch_confirm';
    const itemIdPass = 'item_pass_1';
    const itemIdBlocked = 'item_blocked_1';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO creation_batches (id, creator_handle, batch_count, status, progress, created_at, updated_at)
      VALUES (?, ?, 2, 'completed', 100, ?, ?)
    `).run(batchId, testHandle, now, now);

    db.prepare(`
      INSERT INTO generation_items (id, batch_id, sequence_no, title, angle, generated_text, compliance_status, is_confirmed, created_at, updated_at)
      VALUES (?, ?, 1, '正常推文', '角度A', '合规正常的推文正文', 'PASS', 0, ?, ?)
    `).run(itemIdPass, batchId, now, now);

    db.prepare(`
      INSERT INTO generation_items (id, batch_id, sequence_no, title, angle, generated_text, compliance_status, is_confirmed, created_at, updated_at)
      VALUES (?, ?, 2, '违规推文', '角度B', '稳赚不赔！电话13800000000', 'BLOCKED', 0, ?, ?)
    `).run(itemIdBlocked, batchId, now, now);

    const confirmResult = CreationFactoryService.confirmItem(batchId, itemIdPass);
    expect(confirmResult.confirmed).toBe(true);
    expect(confirmResult.webIntentUrl).toContain('x.com/intent/tweet');

    expect(() => {
      CreationFactoryService.confirmItem(batchId, itemIdBlocked);
    }).toThrow(/高风险违规内容已被合规引擎阻止发布/);
  });
});
