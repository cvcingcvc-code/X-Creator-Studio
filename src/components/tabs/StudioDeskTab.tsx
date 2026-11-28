'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Target,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Send,
  Trash2,
  Plus,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Smartphone,
  Edit3,
  ClipboardCheck,
  Info
} from 'lucide-react';
import { StudioGoalType } from '@/types';

interface StudioDeskTabProps {
  creatorHandle: string;
  onGoToKnowledge: () => void;
  onRefreshStats?: () => void;
}

const GOAL_CARDS: Array<{
  id: StudioGoalType;
  label: string;
  desc: string;
  icon: any;
}> = [
  { id: 'engagement', label: '引导互动', desc: '拉高评论回复与讨论', icon: MessageSquare },
  { id: 'exposure', label: '增加曝光', desc: '强钩子、高停留转发', icon: TrendingUp },
  { id: 'app_validation', label: '做 APP 蓄水', desc: '试探痛点、攒种子用户', icon: Smartphone },
  { id: 'custom', label: '自定义目标', desc: '输入本次特定目的', icon: Edit3 }
];

async function copyTextSafely(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function StudioDeskTab({
  creatorHandle,
  onGoToKnowledge,
  onRefreshStats
}: StudioDeskTabProps) {
  const [summary, setSummary] = useState<any>(null);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftView, setDraftView] = useState<'ready' | 'published'>('ready');

  // 热点导入
  const [importText, setImportText] = useState('');
  const [sourceNote, setSourceNote] = useState('同事/Grok 搜集');
  const [importing, setImporting] = useState(false);
  const [importTip, setImportTip] = useState<string | null>(null);

  // 目标与生成
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [quickIdeaText, setQuickIdeaText] = useState('');
  const [goalType, setGoalType] = useState<StudioGoalType>('engagement');
  const [goalDetail, setGoalDetail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genNotice, setGenNotice] = useState<string | null>(null);
  const [gptPrompt, setGptPrompt] = useState<string | null>(null);

  // 复制提示状态
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const [copiedGpt, setCopiedGpt] = useState(false);

  const loadAll = async () => {
    try {
      const [hsRes, drRes] = await Promise.all([
        fetch(`/api/studio/hotspots?handle=${encodeURIComponent(creatorHandle)}`),
        fetch(`/api/studio/drafts?handle=${encodeURIComponent(creatorHandle)}`)
      ]);
      const hsData = await hsRes.json();
      const drData = await drRes.json();

      setHotspots(hsData.hotspots || []);
      setDrafts(drData.drafts || []);
      setSummary(drData.summary || hsData.summary || null);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('加载创作台失败:', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, [creatorHandle]);

  const handleImportHotspots = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setImportTip(null);
    try {
      const res = await fetch('/api/studio/hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle,
          rawText: importText.trim(),
          sourceNote: sourceNote.trim() || '人工导入'
        })
      });
      const data = await res.json();
      if (data.success) {
        setImportText('');
        setImportTip(
          `已导入 ${data.imported?.length || 0} 条热点${
            data.skippedDuplicates ? `（跳过 ${data.skippedDuplicates} 条重复）` : ''
          }`
        );
        if (data.imported?.length > 0) {
          setSelectedHotspotId(data.imported[0].id);
        }
        await loadAll();
      } else {
        setImportTip(`导入失败：${data.error}`);
      }
    } catch (err: any) {
      setImportTip(`网络异常：${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteHotspot = async (id: string) => {
    await fetch(`/api/studio/hotspots?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (selectedHotspotId === id) setSelectedHotspotId(null);
    loadAll();
  };

  const handleGenerate = async () => {
    const selected = hotspots.find(h => h.id === selectedHotspotId);
    const useText = quickIdeaText.trim() || selected?.content || '';
    if (!useText) {
      alert('请先在左侧选中一条已导入的热点，或直接输入一条临时想法/热点');
      return;
    }

    setGenerating(true);
    setGenNotice(null);
    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle,
          hotspotId: quickIdeaText.trim() ? undefined : selected?.id,
          hotspotTitle: quickIdeaText.trim() ? undefined : selected?.title,
          hotspotText: useText,
          goalType,
          goalDetail: goalDetail.trim(),
          count: 3
        })
      });
      const data = await res.json();
      if (data.success) {
        setGenNotice(data.notice || null);
        setGptPrompt(data.gptBridgePrompt || null);
        setDraftView('ready');
        await loadAll();
      } else {
        alert(`生成失败：${data.error}`);
      }
    } catch (err: any) {
      alert(`生成请求异常：${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyDraft = async (draft: any, openX = false) => {
    const ok = await copyTextSafely(draft.mainText);
    if (ok) {
      setCopiedId(draft.id);
      setTimeout(() => setCopiedId(prev => (prev === draft.id ? null : prev)), 2000);
    }

    await fetch('/api/studio/drafts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: draft.id, action: 'copy' })
    });
    loadAll();

    if (openX) {
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(draft.mainText)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  const handleCopyComment = async (draft: any) => {
    if (!draft.firstComment) return;
    const ok = await copyTextSafely(draft.firstComment);
    if (ok) {
      setCopiedCommentId(draft.id);
      setTimeout(() => setCopiedCommentId(prev => (prev === draft.id ? null : prev)), 2000);
    }
  };

  const handleMarkPublished = async (draft: any) => {
    const res = await fetch('/api/studio/drafts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: draft.id, action: 'publish' })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || '标记失败');
      return;
    }
    loadAll();
  };

  const handleDeleteDraft = async (id: string) => {
    await fetch(`/api/studio/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadAll();
  };

  const visibleDrafts = drafts.filter(d =>
    draftView === 'published' ? d.status === 'published' : d.status !== 'published'
  );

  return (
    <div className="space-y-5">
      {/* Top compact status bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="frost-card rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">文本生成引擎</div>
            <div className="text-xs font-bold text-white mt-0.5">
              {summary?.llmConfigured
                ? `${summary.llmProvider} (${summary.llmModel})`
                : '未配置 DEEPSEEK_API_KEY'}
            </div>
          </div>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              summary?.llmConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
        </div>

        <button
          onClick={onGoToKnowledge}
          className="frost-card rounded-2xl p-3.5 border border-slate-800 hover:border-cyan-500/40 transition-colors flex items-center justify-between text-left"
        >
          <div>
            <div className="text-[11px] text-slate-400">我的历史风格样本</div>
            <div className="text-xs font-bold text-white mt-0.5">
              {summary?.styleSamplesCount || 0} 篇
              <span className="ml-1.5 text-[10px] font-normal text-cyan-400">
                {(summary?.styleSamplesCount || 0) === 0 ? '去导入历史帖子 →' : '管理风格库 →'}
              </span>
            </div>
          </div>
          <BookOpen className="h-4 w-4 text-cyan-400" />
        </button>

        <div className="frost-card rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">待发文案池</div>
            <div className="text-base font-mono font-bold text-cyan-300">
              {summary?.readyDraftsCount || 0} 条
            </div>
          </div>
          <Sparkles className="h-4 w-4 text-cyan-400" />
        </div>

        <div className="frost-card rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">已发布防重账本</div>
            <div className="text-base font-mono font-bold text-emerald-400">
              {summary?.publishedDraftsCount || 0} 条
            </div>
          </div>
          <ClipboardCheck className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      {/* Main 2-column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (5 cols): Import Hotspots + Pick Goal + Generate */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. 人工/他人热点一键导入 */}
          <div className="frost-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-400" />
                <span>① 一键导入热点（他人搜集 / Grok 总结）</span>
              </h3>
            </div>

            <textarea
              rows={4}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="直接粘贴同事或 Grok 搜集好的热点文字；一次导入多条可用 --- 分隔..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none leading-relaxed"
            />

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sourceNote}
                onChange={e => setSourceNote(e.target.value)}
                placeholder="来源备注（如：同事搜集 / Grok）"
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-cyan-500/40 focus:outline-none"
              />
              <button
                onClick={handleImportHotspots}
                disabled={importing || !importText.trim()}
                className="flex items-center gap-1 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400" />
                <span>{importing ? '导入中...' : '入库热点'}</span>
              </button>
            </div>

            {importTip && (
              <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-[11px] text-cyan-300">
                {importTip}
              </div>
            )}

            {/* Imported hotspot list */}
            {hotspots.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1 border-t border-slate-800/70">
                <div className="text-[11px] text-slate-400">
                  点击选中一条热点用于创作（共 {hotspots.length} 条）：
                </div>
                {hotspots.map(hs => {
                  const isSelected = selectedHotspotId === hs.id;
                  return (
                    <div
                      key={hs.id}
                      onClick={() => {
                        setSelectedHotspotId(hs.id);
                        setQuickIdeaText('');
                      }}
                      className={`cursor-pointer rounded-xl border p-2.5 text-xs transition-all flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] ${
                              hs.status === 'used'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-orange-500/10 text-orange-300'
                            }`}
                          >
                            {hs.status === 'used' ? '已发过' : '待写'}
                          </span>
                          <span className="font-medium text-slate-200 truncate">{hs.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{hs.sourceNote}</div>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteHotspot(hs.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 shrink-0"
                        title="删除热点"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. 选定运营目标并生成 */}
          <div className="frost-card rounded-2xl p-4 border border-slate-800 space-y-3.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Target className="h-4 w-4 text-cyan-400" />
              <span>② 选择本次目标并生成风格文案</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {GOAL_CARDS.map(g => {
                const Icon = g.icon;
                const active = goalType === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoalType(g.id)}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      active
                        ? 'border-cyan-500/60 bg-cyan-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className={`h-3.5 w-3.5 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>{g.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{g.desc}</div>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={goalDetail}
              onChange={e => setGoalDetail(e.target.value)}
              placeholder={
                goalType === 'app_validation'
                  ? '补充 APP 方向（可选，如：帮独立开发者做内容防重的小工具）'
                  : '补充本次具体目标或想引导的观点（可选）'
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />

            <textarea
              rows={2}
              value={quickIdeaText}
              onChange={e => setQuickIdeaText(e.target.value)}
              placeholder="或者不选上方热点，直接在这里输入一句临时想法..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50"
            >
              <Sparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? '正在结合历史风格与防重规则创作...' : '生成 3 版待发文案'}</span>
            </button>

            {gptPrompt && (
              <button
                type="button"
                onClick={async () => {
                  await copyTextSafely(gptPrompt);
                  setCopiedGpt(true);
                  setTimeout(() => setCopiedGpt(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/70 py-2 text-[11px] text-slate-300 hover:text-cyan-300 transition-colors"
              >
                {copiedGpt ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedGpt ? '已复制！直接粘贴到 ChatGPT 即可' : '顺便复制专属风格 Prompt（可贴去 GPT 精修）'}</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): Ready Drafts + One-Click Copy + Mark Published Log */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
              <button
                onClick={() => setDraftView('ready')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  draftView === 'ready'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ③ 待发文案 ({drafts.filter(d => d.status !== 'published').length})
              </button>
              <button
                onClick={() => setDraftView('published')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  draftView === 'published'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                已发布记录 ({drafts.filter(d => d.status === 'published').length})
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              点击“标记已发”后自动存入本地知识库，下次创作自动防重
            </span>
          </div>

          {genNotice && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{genNotice}</span>
            </div>
          )}

          {visibleDrafts.length === 0 ? (
            <div className="frost-card rounded-2xl p-10 border border-dashed border-slate-800 text-center space-y-2">
              <Sparkles className="h-8 w-8 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">
                {draftView === 'published' ? '还没有已发布记录' : '当前没有待发文案'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {draftView === 'published'
                  ? '在待发文案中一键复制并发送到 X 后，点旁边“标记已发”，这里就会自动沉淀你的发帖账本。'
                  : '在左侧粘贴一条热点（或输入想法），选定“引导互动 / 增加曝光 / 做 APP 蓄水”目标，点一下立即出稿。'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleDrafts.map(draft => {
                const isPublished = draft.status === 'published';
                const isBlocked = draft.complianceStatus === 'BLOCKED';
                const goalLabel = GOAL_CARDS.find(g => g.id === draft.goalType)?.label || '目标';

                return (
                  <div
                    key={draft.id}
                    className={`frost-card rounded-2xl p-4 border transition-all space-y-3 ${
                      isPublished
                        ? 'border-emerald-500/25 bg-emerald-950/10'
                        : isBlocked
                        ? 'border-rose-500/40 bg-rose-950/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                          {goalLabel}
                        </span>
                        <span className="text-[11px] text-slate-300 font-medium">{draft.angle}</span>
                        {draft.status === 'copied' && (
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-300">
                            已复制
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span
                          className={`rounded-full px-2 py-0.5 border ${
                            draft.originalityStatus === 'passed'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          原创 {draft.originalityScore}%
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 border font-semibold ${
                            draft.complianceStatus === 'PASS'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : draft.complianceStatus === 'FLAGGED'
                              ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                              : 'border-rose-500/30 bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {draft.complianceStatus}
                        </span>
                      </div>
                    </div>

                    {/* Main copy */}
                    <div className="rounded-xl bg-slate-950 border border-slate-900 p-3.5 text-xs text-slate-100 whitespace-pre-wrap leading-relaxed">
                      {draft.mainText}
                    </div>

                    {/* First comment suggestion */}
                    {draft.firstComment && (
                      <div className="rounded-xl bg-slate-900/60 border border-slate-800/70 p-2.5 flex items-start justify-between gap-2 text-[11px]">
                        <div className="text-slate-300">
                          <span className="text-cyan-400 font-semibold">建议自带首评：</span>
                          {draft.firstComment}
                        </div>
                        <button
                          onClick={() => handleCopyComment(draft)}
                          className="shrink-0 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:text-cyan-300"
                        >
                          {copiedCommentId === draft.id ? '已复制' : '复制首评'}
                        </button>
                      </div>
                    )}

                    {/* Action bar: One-click Copy + Open X + Mark Published */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                      <div className="text-[10px] text-slate-500">
                        来源热点：{draft.hotspotTitle.slice(0, 26)}
                        {draft.publishedAt
                          ? ` · 已发布于 ${new Date(draft.publishedAt).toLocaleString()}`
                          : ''}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleCopyDraft(draft, false)}
                          className="flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                        >
                          {copiedId === draft.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span>已复制</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>一键复制</span>
                            </>
                          )}
                        </button>

                        {!isPublished && !isBlocked && (
                          <button
                            onClick={() => handleCopyDraft(draft, true)}
                            className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 hover:text-white transition-colors"
                          >
                            <Send className="h-3.5 w-3.5 text-cyan-400" />
                            <span>复制并去 X 发</span>
                          </button>
                        )}

                        {isPublished ? (
                          <span className="flex items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>已记录入库</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleMarkPublished(draft)}
                            disabled={isBlocked}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isBlocked
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>标记已发 ✓</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
