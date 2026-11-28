import { describe, it, expect } from 'vitest';
import { SearchOrchestratorService } from '../src/lib/search/search-orchestrator.service';
import { WebSearchApiProvider, XAiSearchProvider } from '../src/lib/search/providers/web-search';

describe('真实联网搜索与信源雷达系统', () => {
  it('1. 缺少 API Key 时明确提示未配置，绝不返回模拟假数据', async () => {
    // 强制清除环境变量模拟未配置状态
    const oldTavily = process.env.TAVILY_API_KEY;
    const oldXai = process.env.XAI_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.XAI_API_KEY;

    const webSearch = new WebSearchApiProvider();
    const xaiSearch = new XAiSearchProvider();

    expect(webSearch.isConfigured()).toBe(false);
    expect(xaiSearch.isConfigured()).toBe(false);

    const webRes = await webSearch.search('测试未配置');
    expect(webRes.configured).toBe(false);
    expect(webRes.items.length).toBe(0);
    expect(webRes.message).toContain('未配置搜索 API Key');

    const xaiRes = await xaiSearch.search('测试未配置');
    expect(xaiRes.configured).toBe(false);
    expect(xaiRes.items.length).toBe(0);
    expect(xaiRes.message).toContain('未配置 xAI API Key');

    // 恢复
    if (oldTavily) process.env.TAVILY_API_KEY = oldTavily;
    if (oldXai) process.env.XAI_API_KEY = oldXai;
  });

  it('2. 真实公共信源 (GitHub / HN) 返回具备真实可信来源的结构化条目', async () => {
    const result = await SearchOrchestratorService.executeSearch('AI agent', {
      limit: 3,
      enabledProviders: ['github', 'hackernews']
    });

    expect(result.providerReports.length).toBe(2);
    expect(result.items.length).toBeGreaterThan(0);

    const first = result.items[0];
    expect(first.url).toMatch(/^https?:\/\//);
    expect(first.source).toBeDefined();
    expect(first.credibilityScore).toBeGreaterThanOrEqual(70);
    expect(first.fetchedAt).toBeDefined();
  });
});
