'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCw,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  DollarSign,
  Clock,
  Send,
  Upload,
  Edit3,
  Save,
  Info
} from 'lucide-react';
import { BatchCount } from '@/types';

interface FactoryTabProps {
  creatorHandle: string;
  initialTopic?: string;
}

export function FactoryTab({ creatorHandle, initialTopic }: FactoryTabProps) {
  const [batchCount, setBatchCount] = useState<BatchCount>(5);
  const [topic, setTopic] = useState(initialTopic || 'AI 工具落地与独立产品复盘');
  const [generating, setGenerating] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<any>(null);
  const [runtime, setRuntime] = useState<any>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraftText, setEditDraftText] = useState('');
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    fetch(`/api/factory/batch?handle=${encodeURIComponent(creatorHandle)}`)
      .then(res => res.json())
      .then(data => {
        if (data.runtime) setRuntime(data.runtime);
      })
      .catch(() => {});
  }, [creatorHandle]);

  const startBatch = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/factory/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle,
          count: batchCount,
          customTopic: topic.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBatch(data.batch);
      } else {
        alert(`批量生成失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`网络异常: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleTogglePause = async () => {
    if (!currentBatch) return;
    const action = currentBatch.status === 'paused' ? 'resume' : 'pause';
    try {
      const res = await fetch(`/api/factory/batch/${currentBatch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success && data.batch) {
        setCurrentBatch((prev: any) => ({ ...prev, status: data.batch.status }));
      }
    } catch (err: any) {
      alert(`切换任务状态失败: ${err.message}`);
    }
  };

  const handleRegenerate = async (itemId: string) => {
    if (!currentBatch) return;
    setRegeneratingId(itemId);
    try {
      const res = await fetch(`/api/factory/batch/${currentBatch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate',
          itemId
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBatch((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) => (it.id === itemId ? data.item : it))
        }));
      }
    } catch (err: any) {
      alert(`重试失败: ${err.message}`);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!currentBatch) return;
    setSavingItemId(itemId);
    try {
      const res = await fetch(`/api/factory/batch/${currentBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          generatedText: editDraftText
        })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setCurrentBatch((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) => (it.id === itemId ? data.item : it))
        }));
        setEditingItemId(null);
      }
    } catch (err: any) {
      alert(`保存编辑失败: ${err.message}`);
    } finally {
      setSavingItemId(null);
    }
  };

  const handleUploadImage = (itemId: string, file?: File) => {
    if (!currentBatch || !file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      try {
        const res = await fetch(`/api/factory/batch/${currentBatch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId,
            imageUrl: dataUrl
          })
        });
        const data = await res.json();
        if (data.success && data.item) {
          setCurrentBatch((prev: any) => ({
            ...prev,
            items: prev.items.map((it: any) => (it.id === itemId ? data.item : it))
          }));
        }
      } catch (err: any) {
        alert(`上传图片失败: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPublish = async (itemId: string) => {
    if (!currentBatch) return;
    try {
      const res = await fetch(`/api/factory/batch/${currentBatch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          itemId
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBatch((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) =>
            it.id === itemId ? { ...it, isConfirmed: true, status: 'confirmed' } : it
          )
        }));

        if (data.webIntentUrl) {
          window.open(data.webIntentUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        alert(`确认失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`确认处理异常: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>批量图文创作工厂 (Batch Creation Factory)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-normal">
            1 / 5 / 10 / 20 组批次 · 真实网络基底 · 双模型解耦
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          完整流水线：真实搜索 → 知识库匹配 → 选题去重 → 图片设计/人工上传 → 文案生成 → 原创性检测 → 合规审核 → 人工终审 → 导出发布。
        </p>
      </div>

      {/* Pipeline Control Card */}
      <div className="frost-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">本批次创作主题 / 灵感方向：</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="例如：AI 工具工程化落地与踩坑复盘..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">生成批次数量：</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 20].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setBatchCount(cnt as BatchCount)}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                    batchCount === cnt
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cnt} 组
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/80 pt-4 gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  runtime?.textApiConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              文字模型：
              {runtime?.textApiConfigured
                ? `${runtime.textModel}（已配置）`
                : '未配置 LLM_API_KEY（输出结构化草稿）'}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  runtime?.imageApiConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              生图模型：
              {runtime?.imageApiConfigured
                ? `${runtime.imageModel}（已配置）`
                : '未配置 IMAGE_API_KEY（支持人工上传）'}
            </span>
          </div>

          <button
            onClick={startBatch}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-600/25 hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? '流水线正在批量生产与查重...' : `启动批量生成 (${batchCount} 组图文)`}</span>
          </button>
        </div>
      </div>

      {/* Honest Provider Notices */}
      {currentBatch?.providerNotices && currentBatch.providerNotices.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-1.5 text-xs text-amber-200">
          <div className="font-semibold flex items-center gap-1.5 text-amber-300">
            <Info className="h-4 w-4" />
            <span>模型接口运行实况提示（绝不伪造 API 调用）：</span>
          </div>
          {currentBatch.providerNotices.map((msg: string, idx: number) => (
            <p key={idx} className="text-[11px] text-amber-200/85 leading-relaxed">
              • {msg}
            </p>
          ))}
        </div>
      )}

      {/* Batch Overview & Items List */}
      {currentBatch && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-200">批次 ID: {currentBatch.id}</span>
              <span
                className={`rounded-md px-2 py-0.5 border ${
                  currentBatch.status === 'paused'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {currentBatch.status === 'paused' ? '已暂停审核' : '100% 生产完成'}
              </span>
              <button
                onClick={handleTogglePause}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
              >
                {currentBatch.status === 'paused' ? (
                  <>
                    <Play className="h-3 w-3 text-emerald-400" />
                    <span>恢复任务</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3 text-amber-400" />
                    <span>暂停任务</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Tokens: {currentBatch.totalTokensUsed}</span>
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                <span>实际预估成本: ${currentBatch.estimatedCostUsd}</span>
              </span>
            </div>
          </div>

          {/* Cards for each generated item */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentBatch.items.map((item: any, idx: number) => {
              const isBlocked = item.complianceStatus === 'BLOCKED';
              const isFlagged = item.complianceStatus === 'FLAGGED' || item.originalityStatus === 'flagged';
              const isEditing = editingItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`frost-card rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                    isBlocked
                      ? 'border-rose-500/40 bg-rose-950/10'
                      : isFlagged
                      ? 'border-amber-500/30'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Sequence & Status Badges */}
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 font-mono font-bold shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">{item.topic}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            item.originalityStatus === 'passed'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          原创度: {item.originalityScore}%
                        </span>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            item.complianceStatus === 'PASS'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : item.complianceStatus === 'FLAGGED'
                              ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                              : 'border-rose-500/30 bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {item.complianceStatus === 'PASS'
                            ? '合规PASS'
                            : item.complianceStatus === 'FLAGGED'
                            ? '需复核'
                            : '高危拦截'}
                        </span>
                      </div>
                    </div>

                    {/* Angle */}
                    <div className="text-[11px] text-slate-400 bg-slate-900/60 rounded-lg p-2 border border-slate-800/60">
                      <span className="text-cyan-400 font-medium">切入视角：</span>
                      {item.angle}
                    </div>

                    {/* Text Body (Editable) */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          rows={7}
                          value={editDraftText}
                          onChange={e => setEditDraftText(e.target.value)}
                          className="w-full rounded-xl border border-cyan-500/40 bg-slate-950 p-3 text-xs text-slate-100 focus:outline-none leading-relaxed"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="rounded-lg px-3 py-1 text-xs text-slate-400 hover:text-white"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={savingItemId === item.id}
                            className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-500"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>{savingItemId === item.id ? '重审保存中...' : '保存并重新审核'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed border border-slate-900">
                        {item.generatedText}
                      </div>
                    )}

                    {/* Visual Asset Prompt / Manual Upload */}
                    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-blue-400 font-medium">
                          <ImageIcon className="h-3.5 w-3.5" />
                          视觉配图与素材查重
                        </span>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200 hover:border-cyan-500/40">
                          <Upload className="h-3 w-3 text-cyan-400" />
                          <span>{item.imageUrl ? '更换素材' : '人工上传图片'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleUploadImage(item.id, e.target.files?.[0])}
                          />
                        </label>
                      </div>

                      {item.imageUrl ? (
                        <div className="space-y-1">
                          <img
                            src={item.imageUrl}
                            alt={item.topic}
                            className="max-h-40 w-full rounded-lg object-cover border border-slate-800"
                          />
                          <div className="text-[10px] text-emerald-400">
                            ✓ 已绑定真实配图并纳入 dHash 感知哈希查重
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-mono italic">
                          未配置生图 API（绝不使用假图）：{item.imagePrompt}
                        </p>
                      )}
                    </div>

                    {/* Violations notice if any */}
                    {item.complianceViolations && item.complianceViolations.length > 0 && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-[11px] text-rose-300 space-y-1">
                        <div className="font-semibold flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          合规引擎提醒：
                        </div>
                        {item.complianceViolations.map((v: string, i: number) => (
                          <div key={i}>• {v}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRegenerate(item.id)}
                        disabled={regeneratingId === item.id || currentBatch.status === 'paused'}
                        className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${regeneratingId === item.id ? 'animate-spin' : ''}`} />
                        <span>重生成</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingItemId(item.id);
                          setEditDraftText(item.generatedText);
                        }}
                        disabled={currentBatch.status === 'paused'}
                        className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>编辑</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.isConfirmed ? (
                        <span className="flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>已人工确认</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirmPublish(item.id)}
                          disabled={isBlocked || currentBatch.status === 'paused'}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold transition-all shadow-md ${
                            isBlocked || currentBatch.status === 'paused'
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-600/20'
                          }`}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>人工确认并导出发推</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
