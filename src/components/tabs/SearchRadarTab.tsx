'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search as SearchIcon, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Radio, 
  Sparkles, 
  Layers, 
  RefreshCw,
  ShieldCheck,
  Clock
} from 'lucide-react';

interface SearchRadarTabProps {
  onUseTopicInFactory?: (topic: string) => void;
}

export function SearchRadarTab({ onUseTopicInFactory }: SearchRadarTabProps) {
  const [query, setQuery] = useState('AI 独立开发 创作者');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [providerReports, setProviderReports] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const executeSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search/live?q=${encodeURIComponent(searchQuery)}&limit=15`);
      const data = await res.json();
      setResults(data.items || []);
      setProviders(data.availableProviders || []);
      setProviderReports(data.providerReports || []);
    } catch (err) {
      console.error('搜索雷达请求失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch(query);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    executeSearch(query.trim());
  };

  const filteredResults = selectedFilter === 'all'
    ? results
    : results.filter(r => r.source.toLowerCase().includes(selectedFilter.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>真实联网雷达 (Real Live Radar)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
            GitHub · Hacker News · 官方 RSS · 真实来源追踪
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          修复旧项目虚假搜索。全面接入真实网络 API，每条资讯均保留原始来源、可信度评分与交叉验证，严禁伪造。
        </p>
      </div>

      {/* Provider Status Banners */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {providers.map(p => (
          <div
            key={p.id}
            className={`rounded-xl p-3 border text-xs space-y-1 ${
              p.configured
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-slate-800 bg-slate-900/40 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 truncate">{p.name.split(' ')[0]}</span>
              {p.configured ? (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <span className="text-[10px] text-amber-400">未配置</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {p.configured ? '真实接口在线' : '无模拟伪造'}
            </div>
          </div>
        ))}
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索开源热点、AI 架构、独立开发趋势..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? '真实探测中...' : '联网探测'}</span>
        </button>
      </form>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-slate-500 text-[11px]">来源筛选：</span>
        {['all', 'GitHub', 'Hacker News', 'RSS'].map(f => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              selectedFilter === f
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            {f === 'all' ? '全部真实信源' : f}
          </button>
        ))}
      </div>

      {/* Search Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResults.map(item => (
          <div
            key={item.id}
            className="frost-card rounded-2xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-cyan-300 font-mono text-[11px]">
                  {item.source}
                </span>

                <div className="flex items-center gap-1.5">
                  {item.crossValidated && (
                    <span className="rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      <span>交叉验证通过</span>
                    </span>
                  )}
                  <span className="text-emerald-400 font-mono text-xs font-semibold">
                    {item.credibilityScore}% 可信
                  </span>
                </div>
              </div>

              <h3 className="text-xs font-bold text-slate-100 line-clamp-2 hover:text-cyan-300 transition-colors">
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </h3>

              <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                {item.summary}
              </p>
            </div>

            <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '最新'}</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                  title="查看原文"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                {onUseTopicInFactory && (
                  <button
                    onClick={() => onUseTopicInFactory(item.title)}
                    className="flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Layers className="h-3 w-3" />
                    <span>入库创作</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
