import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeImporterService } from '../src/lib/knowledge/knowledge-importer.service';
import { KnowledgeGraphService } from '../src/lib/knowledge/knowledge-graph.service';
import { getDb, resetDbForTests } from '../src/lib/db/client';

describe('长期个人知识库与知识图谱系统', () => {
  const testHandle = '@test_creator';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM knowledge_posts WHERE creator_handle = ?').run(testHandle);
    db.prepare('DELETE FROM creators WHERE handle = ?').run(testHandle);
  });

  it('0. 全新数据库初始化不含任何预置私人账号或虚构帖子', () => {
    const memDb = resetDbForTests(':memory:');
    const creatorsCount = (memDb.prepare('SELECT count(*) as c FROM creators').get() as { c: number }).c;
    const postsCount = (memDb.prepare('SELECT count(*) as c FROM knowledge_posts').get() as { c: number }).c;
    const rulesCount = (memDb.prepare('SELECT count(*) as c FROM compliance_rules').get() as { c: number }).c;
    expect(creatorsCount).toBe(0);
    expect(postsCount).toBe(0);
    expect(rulesCount).toBeGreaterThanOrEqual(8);
  });

  it('1. 导入空历史数据时应展示未导入状态，严格不伪造账号数据', () => {
    const graph = KnowledgeGraphService.generateGraph(testHandle);
    expect(graph.hasData).toBe(false);
    expect(graph.totalPosts).toBe(0);
    expect(graph.contentBlindspots[0]).toContain('暂无历史创作数据');
  });

  it('2. 导入历史帖子并自动分类与提取观点', () => {
    const rawPosts = [
      {
        postId: 'post_1001',
        originalText: '体验了 Claude 3.7 与一人公司工作流：AI 最大的价值不是替你写代码，而是重构验证链路。#AI #一人公司',
        publishedAt: '2026-03-01T10:00:00Z',
        impressions: 5000,
        likes: 120
      },
      {
        postId: 'post_1002',
        originalText: '复盘独立开发产品的第 3 个月：踩坑记录，为什么不要在早期搭建复杂微服务。',
        publishedAt: '2026-03-02T10:00:00Z',
        impressions: 8000,
        likes: 240
      }
    ];

    const result = KnowledgeImporterService.importPosts(testHandle, rawPosts, 'json');
    expect(result.importedCount).toBe(2);
    expect(result.skippedDuplicates).toBe(0);

    const graph = KnowledgeGraphService.generateGraph(testHandle);
    expect(graph.hasData).toBe(true);
    expect(graph.totalPosts).toBe(2);
    expect(graph.topicsDistribution.length).toBeGreaterThan(0);
  });

  it('3. 重复导入不会产生重复记录 (严格幂等性防重)', () => {
    const post = [{
      postId: 'post_repeat_1',
      originalText: '这是一篇用于测试重复导入幂等性的重要推文内容。',
      publishedAt: '2026-03-05T12:00:00Z'
    }];

    // 第一次导入
    const res1 = KnowledgeImporterService.importPosts(testHandle, post, 'manual');
    expect(res1.importedCount).toBe(1);
    expect(res1.skippedDuplicates).toBe(0);

    // 第二次导入相同 post_id
    const res2 = KnowledgeImporterService.importPosts(testHandle, post, 'manual');
    expect(res2.importedCount).toBe(0);
    expect(res2.skippedDuplicates).toBe(1);

    // 第三次导入不同 post_id 但完全相同的内容文本 (哈希防重)
    const res3 = KnowledgeImporterService.importPosts(testHandle, [{
      postId: 'different_id_same_content',
      originalText: '这是一篇用于测试重复导入幂等性的重要推文内容。'
    }], 'manual');
    expect(res3.importedCount).toBe(0);
    expect(res3.skippedDuplicates).toBe(1);
  });

  it('4. 支持纯文本解析器解析多篇帖子', () => {
    const multiText = `
第一篇推文内容关于 AI 自动化与创作者日常。

---

第二篇推文内容关于一人公司商业化实践。
    `;
    const parsed = KnowledgeImporterService.parsePlainText(multiText);
    expect(parsed.length).toBe(2);
    expect(parsed[0].originalText).toContain('第一篇推文');
    expect(parsed[1].originalText).toContain('第二篇推文');
  });
});
