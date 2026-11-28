'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  Image as ImageIcon, 
  Lightbulb, 
  Hash, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface OriginalityTabProps {
  creatorHandle: string;
}

export function OriginalityTab({ creatorHandle }: OriginalityTabProps) {
  const [candidateText, setCandidateText] = useState(
    '“不上班的第 90 天”：当代年轻人如何用 AI 搭建一人公司的第一笔收入？\n从迷茫到决定自己掌控时间的思考。'
  );
  const [imageUrl, setImageUrl] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  const handleAudit = async () => {
    if (!candidateText.trim()) return;
    setAuditing(true);
    try {
      const res = await fetch('/api/originality/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: candidateText,
          creatorHandle,
          imageUrl: imageUrl.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setAuditResult(data.result);
      }
    } catch (err: any) {
      alert(`查重审计异常: ${err.message}`);
    } finally {
      setAuditing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>原创性与重复度检测实验室</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-normal">
            文本哈希 · SimHash · 语义骨架 · 图像感知哈希
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          多层检测文字同质化、核心观点重合度与视觉素材复用。发现重复风险时给出全新切入角度，拒绝同义词替换。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="frost-card rounded-2xl p-5 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Hash className="h-4 w-4 text-cyan-400" />
            <span>输入待检测创作草稿</span>
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">推文文本内容：</label>
            <textarea
              rows={8}
              value={candidateText}
              onChange={e => setCandidateText(e.target.value)}
              placeholder="在此粘贴或输入计划发表的推文草稿..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
              <span>配图 URL 或感知哈希素材（选填）：</span>
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://... 或 Base64"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <button
            onClick={handleAudit}
            disabled={auditing || !candidateText.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50"
          >
            <Sparkles className={`h-4 w-4 ${auditing ? 'animate-spin' : ''}`} />
            <span>{auditing ? '多层查重比对中...' : '启动多层原创性审计'}</span>
          </button>
        </div>

        {/* Audit Results Panel */}
        <div className="frost-card rounded-2xl p-5 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>查重审计报告</span>
          </h3>

          {auditResult ? (
            <div className="space-y-4">
              {/* Score card */}
              <div
                className={`rounded-2xl p-4 border flex items-center justify-between ${
                  auditResult.isOriginal
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-rose-500/30 bg-rose-500/10'
                }`}
              >
                <div>
                  <div className="text-xs text-slate-400">原创性评估等级</div>
                  <div
                    className={`text-base font-bold mt-0.5 flex items-center gap-1.5 ${
                      auditResult.isOriginal ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {auditResult.isOriginal ? (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        <span>原创度优秀（通过查重）</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5" />
                        <span>存在重复或高度重叠风险</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">重复度指标</div>
                  <div
                    className={`text-2xl font-mono font-bold ${
                      auditResult.isOriginal ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {auditResult.duplicateScore}%
                  </div>
                </div>
              </div>

              {/* Matched post snippet */}
              {auditResult.matchedPostId && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-1.5">
                  <div className="text-slate-400 font-medium">重叠来源参考：</div>
                  <div className="text-cyan-400 font-mono text-[11px]">
                    来源 ID: {auditResult.matchedPostId}
                  </div>
                  {auditResult.matchedSnippet && (
                    <div className="text-slate-300 italic border-l-2 border-cyan-500/40 pl-2 text-[11px]">
                      "{auditResult.matchedSnippet}..."
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate reasons */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">查重判定原因：</div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {auditResult.reasons.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggested new angles */}
              {auditResult.suggestedNewAngles && auditResult.suggestedNewAngles.length > 0 && (
                <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span>系统建议：新的破局创作切入角度</span>
                  </div>
                  <ul className="space-y-2 text-xs text-amber-200/90">
                    {auditResult.suggestedNewAngles.map((angle: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ArrowRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <span>{angle}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <ShieldCheck className="h-10 w-10 text-slate-600" />
              <p className="text-xs">在左侧输入草稿并点击“启动多层原创性审计”</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
