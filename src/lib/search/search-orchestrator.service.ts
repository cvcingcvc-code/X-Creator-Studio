import { SearchProvider, ProviderSearchResult, SearchOptions } from './providers/provider.interface';
import { GitHubSearchProvider } from './providers/github';
import { HackerNewsSearchProvider } from './providers/hackernews';
import { RssSearchProvider } from './providers/rss';
import { WebSearchApiProvider, XAiSearchProvider } from './providers/web-search';
import { SearchItem } from '@/types';
import { getDb } from '@/lib/db/client';

export interface MultiSearchResult {
  query: string;
  totalResults: number;
  providerReports: {
    providerId: string;
    providerName: string;
    configured: boolean;
    message?: string;
    count: number;
  }[];
  items: (SearchItem & { crossValidated?: boolean; validationCount?: number })[];
  fetchedAt: string;
}

export class SearchOrchestratorService {
  private static providers: SearchProvider[] = [
    new GitHubSearchProvider(),
    new HackerNewsSearchProvider(),
    new RssSearchProvider(),
    new WebSearchApiProvider(),
    new XAiSearchProvider()
  ];

  public static getProvidersStatus() {
    return this.providers.map(p => ({
      id: p.id,
      name: p.name,
      configured: p.isConfigured()
    }));
  }

  /**
   * 聚合多源真实联网搜索
   */
  public static async executeSearch(
    query: string,
    options?: SearchOptions & { enabledProviders?: string[] }
  ): Promise<MultiSearchResult> {
    const fetchedAt = new Date().toISOString();
    const enabledIds = options?.enabledProviders || ['github', 'hackernews', 'rss', 'web_search', 'xai_search'];

    const targetProviders = this.providers.filter(p => enabledIds.includes(p.id));

    // 并行拉取各搜索源
    const reportPromises = targetProviders.map(p => p.search(query, options));
    const reports: ProviderSearchResult[] = await Promise.all(reportPromises);

    const providerReports = reports.map(r => ({
      providerId: r.providerId,
      providerName: r.providerName,
      configured: r.configured,
      message: r.message,
      count: r.items.length
    }));

    // 汇总结果并去重
    const allItems: SearchItem[] = [];
    const seenUrls = new Set<string>();

    for (const r of reports) {
      for (const item of r.items) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allItems.push(item);
        }
      }
    }

    // 交叉验证算法 (Cross-Validation)：
    // 计算各条目与其他条目的关键词重合度，若同一事件被多个不同来源（如 GitHub 与 Hacker News）报道，增加可信度
    const enrichedItems = allItems.map(item => {
      let validationCount = 1;
      const titleWords = item.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);

      for (const other of allItems) {
        if (other.url === item.url || other.source === item.source) continue;
        const otherLower = (other.title + ' ' + other.summary).toLowerCase();
        const matches = titleWords.filter(w => otherLower.includes(w));
        if (matches.length >= 2) {
          validationCount++;
        }
      }

      const crossValidated = validationCount > 1;
      const boostedScore = Math.min(99, item.credibilityScore + (crossValidated ? 5 : 0));

      return {
        ...item,
        credibilityScore: boostedScore,
        crossValidated,
        validationCount
      };
    });

    // 排序：优先可信度高、最新发布
    enrichedItems.sort((a, b) => b.credibilityScore - a.credibilityScore);

    // 缓存搜索日志到 SQLite
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO search_cache (id, query, provider, raw_results, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        query,
        'multi_orchestrator',
        JSON.stringify(enrichedItems.slice(0, 30)),
        new Date(Date.now() + 3600 * 1000).toISOString(),
        fetchedAt
      );
    } catch {}

    return {
      query,
      totalResults: enrichedItems.length,
      providerReports,
      items: enrichedItems,
      fetchedAt
    };
  }
}
