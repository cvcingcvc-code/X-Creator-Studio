import { SearchProvider, SearchOptions, ProviderSearchResult } from './provider.interface';
import { SearchItem } from '@/types';

export class WebSearchApiProvider implements SearchProvider {
  public id = 'web_search';
  public name = '全网实时搜索 (Tavily / Serper)';

  public isConfigured(): boolean {
    return Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY);
  }

  public async search(query: string, options?: SearchOptions): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        providerName: this.name,
        configured: false,
        message: '未配置搜索 API Key (TAVILY_API_KEY 或 SERPER_API_KEY)。系统严格遵循真实联网原则，绝不返回虚假伪造搜索结果。请在服务端环境变量中配置。',
        items: []
      };
    }

    const fetchedAt = new Date().toISOString();
    const limit = options?.limit || 10;

    // 优先使用 Tavily
    if (process.env.TAVILY_API_KEY) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: 'basic',
            max_results: limit
          })
        });

        if (!res.ok) {
          return {
            providerId: this.id,
            providerName: this.name,
            configured: true,
            message: `Tavily 搜索请求失败: HTTP ${res.status}`,
            items: []
          };
        }

        const data = await res.json();
        const items: SearchItem[] = (data.results || []).map((r: any, idx: number) => ({
          id: `tavily_${idx}_${Date.now()}`,
          title: r.title || '无标题网页',
          url: r.url,
          source: 'Tavily Web Search',
          summary: r.content || '',
          publishedAt: r.published_date || fetchedAt,
          fetchedAt,
          credibilityScore: 85,
          verified: true
        }));

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
          message: `Tavily 网络连接异常: ${err.message}`,
          items: []
        };
      }
    }

    // 使用 Serper Google Search API
    if (process.env.SERPER_API_KEY) {
      try {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': process.env.SERPER_API_KEY
          },
          body: JSON.stringify({ q: query, num: limit })
        });

        if (!res.ok) {
          return {
            providerId: this.id,
            providerName: this.name,
            configured: true,
            message: `Serper 搜索请求失败: HTTP ${res.status}`,
            items: []
          };
        }

        const data = await res.json();
        const items: SearchItem[] = (data.organic || []).map((r: any, idx: number) => ({
          id: `serper_${idx}_${Date.now()}`,
          title: r.title || '无标题网页',
          url: r.link,
          source: 'Serper Web Search',
          summary: r.snippet || '',
          publishedAt: r.date || fetchedAt,
          fetchedAt,
          credibilityScore: 84,
          verified: true
        }));

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
          message: `Serper 网络连接异常: ${err.message}`,
          items: []
        };
      }
    }

    return {
      providerId: this.id,
      providerName: this.name,
      configured: false,
      message: '未启用支持的搜索提供商配置',
      items: []
    };
  }
}

export class XAiSearchProvider implements SearchProvider {
  public id = 'xai_search';
  public name = 'xAI Grok & X 官方搜索 (预留通道)';

  public isConfigured(): boolean {
    return Boolean(process.env.XAI_API_KEY || (process.env.TWITTER_API_KEY && process.env.TWITTER_BEARER_TOKEN));
  }

  public async search(query: string, options?: SearchOptions): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        providerName: this.name,
        configured: false,
        message: '未配置 xAI API Key (XAI_API_KEY) 或 X 官方开发者凭证 (TWITTER_BEARER_TOKEN)。根据平台准则与真实联网原则，未配置时不伪造数据。',
        items: []
      };
    }

    return {
      providerId: this.id,
      providerName: this.name,
      configured: true,
      message: 'xAI / X 官方接口凭证已检测到，当前为预留通道，需按官方 API 配额与权限进一步启用。',
      items: []
    };
  }
}
