import { SearchProvider, SearchOptions, ProviderSearchResult } from './provider.interface';
import { SearchItem } from '@/types';

export class GitHubSearchProvider implements SearchProvider {
  public id = 'github';
  public name = 'GitHub 开源趋势与代码库';

  public isConfigured(): boolean {
    // GitHub 公开搜索 API 可免 Key 匿名调用（或带 GITHUB_TOKEN）
    return true;
  }

  public async search(query: string, options?: SearchOptions): Promise<ProviderSearchResult> {
    const limit = options?.limit || 10;
    const q = query.trim() || 'AI agent trending';
    const fetchedAt = new Date().toISOString();

    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${limit}`;

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'X-Creator-Studio-Radar/1.0'
      };

      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const res = await fetch(url, { headers, next: { revalidate: 300 } });

      if (!res.ok) {
        if (res.status === 403) {
          return {
            providerId: this.id,
            providerName: this.name,
            configured: true,
            message: 'GitHub API 限流（Rate Limit Exceeded）。请配置 GITHUB_TOKEN 以提升配额。',
            items: []
          };
        }
        return {
          providerId: this.id,
          providerName: this.name,
          configured: true,
          message: `GitHub 请求失败: HTTP ${res.status} ${res.statusText}`,
          items: []
        };
      }

      const data = await res.json();
      const items: SearchItem[] = (data.items || []).map((repo: any) => {
        // 基于 Star 与更新时间计算可信度评分
        const stars = repo.stargazers_count || 0;
        let credibility = 70;
        if (stars > 1000) credibility = 95;
        else if (stars > 200) credibility = 88;
        else if (stars > 50) credibility = 80;

        return {
          id: `gh_${repo.id}`,
          title: `${repo.full_name}: ${repo.description || '无项目描述'}`,
          url: repo.html_url,
          source: 'GitHub',
          summary: `Stars: ${stars} | Forks: ${repo.forks_count} | Language: ${repo.language || '未知'} | License: ${repo.license?.spdx_id || 'None'}`,
          publishedAt: repo.pushed_at || repo.created_at || fetchedAt,
          fetchedAt,
          credibilityScore: credibility,
          verified: stars > 100
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
        message: `GitHub 联网请求网络异常: ${err.message || String(err)}`,
        items: []
      };
    }
  }
}
