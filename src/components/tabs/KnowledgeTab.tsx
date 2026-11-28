'use client';

import React, { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  Compass,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  RefreshCw,
  Search as SearchIcon
} from 'lucide-react';

interface KnowledgeTabProps {
  creatorHandle: string;
  onRefreshStats?: () => void;
}

export function KnowledgeTab({ creatorHandle, onRefreshStats }: KnowledgeTabProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [postsRes, graphRes] = await Promise.all([
        fetch(`/api/knowledge/posts?handle=${encodeURIComponent(creatorHandle)}`),
        fetch(`/api/knowledge/graph?handle=${encodeURIComponent(creatorHandle)}`)
      ]);

      const postsData = await postsRes.json();
      const graphData = await graphRes.json();

      setPosts(postsData.posts || []);
      setGraph(graphData);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('拉取知识库失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [creatorHandle]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportNotice(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('creatorHandle', creatorHandle);

    try {
      const res = await fetch('/api/knowledge/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const { importedCount, skippedDuplicates, failedCount } = data.result;
        setImportNotice(`导入完成：新增 ${importedCount} 篇，跳过重复 ${skippedDuplicates} 篇，失败 ${failedCount} 篇`);
        fetchData();
      } else {
        setImportNotice(`导入失败：${data.error || '未知错误'}`);
      }
    } catch (err: any) {
      setImportNotice(`网络错误：${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleManualImport = async () => {
    if (!manualText.trim()) return;
    setImporting(true);
    setImportNotice(null);
    try {
      const res = await fetch('/api/knowledge/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle,
          originalText: manualText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.result?.skippedDuplicates > 0) {
          setImportNotice('该内容已存在于知识库中，已自动跳过重复导入。');
        } else {
          setManualText('');
          setShowImportModal(false);
        }
        fetchData();
      }
    } catch (err: any) {
      alert(`录入失败: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge/posts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    window.open(
      `/api/knowledge/export?handle=${encodeURIComponent(creatorHandle)}&format=${format}`,
      '_blank'
    );
  };

  const filteredPosts = posts.filter(p => {
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchSearch =
      !search ||
      p.originalText.toLowerCase().includes(search.toLowerCase()) ||
      (p.theme && p.theme.includes(search));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>长期个人创作知识库</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-normal">
              最高优先级 · 严格查重去重
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            沉淀历史帖子、观点指纹与数据洞察。支持 CSV / Excel / JSON / 文本导入、导出备份与删除，自动生成知识图谱与创作盲区。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/20"
          >
            <Upload className="h-4 w-4" />
            <span>导入历史数据</span>
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={posts.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
            title="导出 JSON 备份"
          >
            <Download className="h-3.5 w-3.5" />
            <span>导出 JSON</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={posts.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
            title="导出 CSV 备份"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>导出 CSV</span>
          </button>
          <button
            onClick={fetchData}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:text-white transition-colors"
            title="刷新"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="frost-card w-full max-w-xl rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">导入历史推文数据 ({creatorHandle})</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all">
                <FileSpreadsheet className="h-8 w-8 text-cyan-400 mb-2" />
                <span className="text-xs font-medium text-slate-200">上传 Analytics CSV / Excel</span>
                <span className="text-[10px] text-slate-400 mt-1">支持官方导出格式 (.csv, .xlsx)</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={importing}
                />
              </label>

              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all">
                <FileText className="h-8 w-8 text-blue-400 mb-2" />
                <span className="text-xs font-medium text-slate-200">上传 JSON 归档 / 文本</span>
                <span className="text-[10px] text-slate-400 mt-1">支持多篇以 --- 分割的纯文本</span>
                <input
                  type="file"
                  accept=".json,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={importing}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">或手动录入单篇内容：</label>
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder="在此粘贴推文正文内容..."
                rows={4}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            {importNotice && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-300">
                {importNotice}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button
                onClick={handleManualImport}
                disabled={!manualText.trim() || importing}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {importing ? '处理中...' : '录入知识库'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Graph & Insights Panel */}
      {graph && graph.hasData ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Topics Distribution */}
          <div className="frost-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <span>创作主题与分类分布</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">共 {graph.totalPosts} 篇</span>
            </div>
            <div className="space-y-2">
              {graph.topicsDistribution.slice(0, 5).map((t: any) => (
                <div key={t.topic} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 truncate">{t.topic}</span>
                    <span className="text-cyan-400 font-mono">{t.count} 篇 ({t.percentage}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${t.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Blindspots */}
          <div className="frost-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span>智能识别：内容盲区与薄弱项</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {graph.contentBlindspots.map((bs: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed bg-amber-500/5 border border-amber-500/10 p-2 rounded-xl text-amber-200/90">
                  <span className="text-amber-400 font-mono mt-0.5">•</span>
                  <span>{bs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Future Recommendations */}
          <div className="frost-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-emerald-400" />
              <span>未来可深入的选题建议</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {graph.futureRecommendations.map((rec: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-xl text-emerald-200/90">
                  <span className="text-emerald-400 font-mono mt-0.5">✦</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="frost-card rounded-2xl p-8 border border-dashed border-slate-800 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-slate-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">
            账号 {creatorHandle} 尚未导入历史创作数据
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            系统严格遵循真实数据原则，绝不虚构任何账号历史记录。请先点击左上角切换为你的 X 账号，并导入真实的 X 归档 JSON、Analytics CSV/Excel 或手动录入历史帖子以激活知识图谱。
          </p>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>立即导入真实历史推文</span>
          </button>
        </div>
      )}

      {/* Posts filter & list */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="搜索历史推文正文或关键词..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/40 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['all', 'AI 技术与工具', '独立开发与创业', '自媒体与增长', '经验踩坑与复盘', '思考与日常'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
                  }`}
                >
                  {cat === 'all' ? '全部主题' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPosts.map(post => (
              <div
                key={post.id}
                className="frost-card rounded-2xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-cyan-300 font-mono">
                      {post.category || '未分类'}
                    </span>
                    <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                      来源: {post.sourceType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '未知时间'}
                    </span>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                      title="删除此记录"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {post.originalText}
                </p>

                {post.coreViewpoint && (
                  <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-2 text-[11px] text-slate-400">
                    <span className="text-cyan-400 font-medium">核心观点：</span>
                    {post.coreViewpoint}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>{post.impressions || 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-rose-400" />
                      <span>{post.likes || 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                      <span>{post.replies || 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{post.retweets || 0}</span>
                    </span>
                  </div>

                  {post.originalUrl && (
                    <a
                      href={post.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-cyan-400/80 hover:text-cyan-300 text-[11px]"
                    >
                      <span>原始帖子</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
