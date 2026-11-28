import { SearchProvider, SearchOptions, ProviderSearchResult } from './provider.interface';
import { SearchItem } from '@/types';

export class HackerNewsSearchProvider implements SearchProvider {
  public id = 'hackernews';
  public name = 'Hacker News 科技头条';

  public isConfigured(): boolean {
    return true; // HN Algolia API 公开免授权
  }

  public async search(query: string, options?: SearchOptions): Promise<ProviderSearchResult> {
    const limit = options?.limit || 10;
    const q = query.trim() || 'AI';
    const fetchedAt = new Date().toISOString();

    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'X-Creator-Studio-Radar/1.0' },
        next: { revalidate: 300 }
      });

      if (!res.ok) {
        return {
          providerId: this.id,
          providerName: this.name,
          configured: true,
          message: `Hacker News 请求失败: HTTP ${res.status}`,
          items: []
        };
      }

      const data = await res.json();
      const items: SearchItem[] = (data.hits || []).map((hit: any) => {
        const points = hit.points || 0;
        let credibility = 75;
        if (points > 300) credibility = 94;
        else if (points > 100) credibility = 88;
        else if (points > 30) credibility = 82;

        return {
          id: `hn_${hit.objectID}`,
          title: hit.title || '无标题故事',
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: 'Hacker News',
          summary: `Score: ${points} points | Comments: ${hit.num_comments || 0} | Author: ${hit.author || 'anon'}`,
          publishedAt: hit.created_at || fetchedAt,
          fetchedAt,
          credibilityScore: credibility,
          verified: points > 50
        };
      });

      return {
        providerId: this.id,
        providerName: this.name,
        configured: true,
        items
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        providerName: this.name,
        configured: true,
        message: `Hacker News 联网网络异常: ${err.message || String(err)}`,
        items: []
      };
    }
  }
}
