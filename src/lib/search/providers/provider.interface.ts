import { SearchItem } from '@/types';

export interface SearchOptions {
  limit?: number;
  timeRange?: 'day' | 'week' | 'month' | 'all';
  category?: string;
}

export interface ProviderSearchResult {
  providerId: string;
  providerName: string;
  configured: boolean;
  message?: string;
  items: SearchItem[];
}

export interface SearchProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  search(query: string, options?: SearchOptions): Promise<ProviderSearchResult>;
}
