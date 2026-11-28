import { SearchProvider, SearchOptions, ProviderSearchResult } from './provider.interface';
import { SearchItem } from '@/types';

export class RssSearchProvider implements SearchProvider {
  public id = 'rss';
  public name = '官方博客与权威技术 RSS';

  private feeds = [
    { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
    { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml' },
    { name: 'ArXiv AI Papers', url: 'https://export.arxiv.org/rss/cs.AI' }
  ];

  public isConfigured(): boolean {
    return true;
  }

  public async search(query: string, options?: SearchOptions): Promise<ProviderSearchResult> {
    const limit = options?.limit || 10;
    const fetchedAt = new Date().toISOString();
    const allItems: SearchItem[] = [];
    const queryLower = query.toLowerCase();

    for (const feed of this.feeds) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'X-Creator-Studio-Radar/1.0' },
          next: { revalidate: 600 }
        });
        clearTimeout(timeoutId);

        if (!res.ok) continue;

        const xml = await res.text();
        const items = this.parseXml(xml, feed.name, fetchedAt);
        
        // 过滤相关性
        const matched = queryLower
          ? items.filter(it => it.title.toLowerCase().includes(queryLower) || it.summary.toLowerCase().includes(queryLower))
          : items;

        allItems.push(...matched);
      } catch {
        // 单个源超时或不可达时不中断其余源
      }
    }

    return {
      providerId: this.id,
      providerName: this.name,
      configured: true,
      items: allItems.slice(0, limit)
    };
  }

  private parseXml(xml: string, feedName: string, fetchedAt: string): SearchItem[] {
    const items: SearchItem[] = [];
    const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
    let match: RegExpExecArray | null;

    let index = 0;
    while ((match = itemRegex.exec(xml)) !== null && index < 15) {
      index++;
      const itemContent = match[1];

      const titleMatch = /<title(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
      const linkMatch = /<link(?:[^>]*?href=["']([^"']+)["']|[^>]*>([\s\S]*?)<\/link>)/i.exec(itemContent);
      const descMatch = /<(?:description|summary)(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i.exec(itemContent);
      const dateMatch = /<(?:pubDate|updated|dc:date)(?:[^>]*)>([\s\S]*?)<\/(?:pubDate|updated|dc:date)>/i.exec(itemContent);

      const title = titleMatch ? this.cleanHtml(titleMatch[1]) : '无标题资讯';
      let link = '';
      if (linkMatch) {
        link = linkMatch[1] || this.cleanHtml(linkMatch[2]);
      }
      const rawDesc = descMatch ? this.cleanHtml(descMatch[1]) : '';
      let publishedAt = fetchedAt;
      if (dateMatch && dateMatch[1]) {
        const parsedDate = new Date(dateMatch[1].trim());
        if (!Number.isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate.toISOString();
        }
      }

      if (title && link) {
        items.push({
          id: `rss_${Buffer.from(link).toString('base64').slice(0, 16)}`,
          title,
          url: link.trim(),
          source: `RSS: ${feedName}`,
          summary: rawDesc.slice(0, 200),
          publishedAt,
          fetchedAt,
          credibilityScore: 92, // 官方源默认具备极高权威可信度
          verified: true
        });
      }
    }

    return items;
  }

  private cleanHtml(str: string): string {
    return str
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
