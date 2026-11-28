'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Lock,
  Plus
} from 'lucide-react';

interface ComplianceTabProps {
  creatorHandle: string;
}

export function ComplianceTab({ creatorHandle }: ComplianceTabProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [testText, setTestText] = useState(
    '欢迎关注！加微信 13800138000 免费领取资料，稳赚不赔！#AI #增长 #暴富 #产品 #工具 #创业'
  );
  const [hasAutoPublish, setHasAutoPublish] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    code: '',
    name: '',
    category: 'copyright',
    severity: 'warning',
    region: 'Global',
    officialSourceUrl: 'https://help.x.com/en/rules-and-policies',
    description: '',
    keywords: ''
  });
  const [savingRule, setSavingRule] = useState(false);

  const loadRules = () => {
    setLoadingRules(true);
    fetch('/api/compliance/rules')
      .then(res => res.json())
      .then(data => {
        setRules(data.rules || []);
      })
      .catch(console.error)
      .finally(() => setLoadingRules(false));
  };

  useEffect(() => {
    loadRules();
  }, []);

  const runAudit = async () => {
    if (!testText.trim()) return;
    setAuditing(true);
    try {
      const res = await fetch('/api/compliance/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          creatorHandle,
          hasAutoPublishRequested: hasAutoPublish
        })
      });
      const data = await res.json();
      if (data.success) {
        setAuditResult(data.result);
      }
    } catch (err: any) {
      alert(`合规检测异常: ${err.message}`);
    } finally {
      setAuditing(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.code.trim() || !newRule.name.trim() || !newRule.description.trim()) return;
    setSavingRule(true);
    try {
      const res = await fetch('/api/compliance/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRule,
          keywords: newRule.keywords
            .split(/[,，]/)
            .map(s => s.trim())
            .filter(Boolean)
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddRule(false);
        setNewRule({
          code: '',
          name: '',
          category: 'copyright',
          severity: 'warning',
          region: 'Global',
          officialSourceUrl: 'https://help.x.com/en/rules-and-policies',
          description: '',
          keywords: ''
        });
        loadRules();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (err: any) {
      alert(`保存规则异常: ${err.message}`);
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>平台与法律合规中心 (Compliance Engine)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-normal">
            X 官方政策 · 自动化准则 · 隐私/反欺诈 · 3级审核
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          覆盖版权、肖像、个人隐私、诽谤、误导性欺诈营销与 X 自动化政策。高风险内容严禁进入发布通道，不确定项提示人工复核。
        </p>
      </div>

      {/* Auditor Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="frost-card rounded-2xl p-5 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>实时文本合规审查测试沙箱</span>
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">输入待审核推文正文：</label>
            <textarea
              rows={6}
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder="输入推文文本..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              id="autoPub"
              checked={hasAutoPublish}
              onChange={e => setHasAutoPublish(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-cyan-500"
            />
            <label htmlFor="autoPub" className="cursor-pointer">
              模拟触发未经人工复核的全自动发布（测试 X 自动化规则拦截）
            </label>
          </div>

          <button
            onClick={runAudit}
            disabled={auditing || !testText.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{auditing ? '审核引擎比对中...' : '执行合规审核'}</span>
          </button>
        </div>

        {/* Audit Report */}
        <div className="frost-card rounded-2xl p-5 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-cyan-400" />
            <span>合规裁决结果</span>
          </h3>

          {auditResult ? (
            <div className="space-y-4">
              <div
                className={`rounded-2xl p-4 border flex items-center justify-between ${
                  auditResult.status === 'PASS'
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : auditResult.status === 'FLAGGED'
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                <div>
                  <div className="text-xs text-slate-400">综合判定等级</div>
                  <div
                    className={`text-base font-bold mt-0.5 flex items-center gap-1.5 ${
                      auditResult.status === 'PASS'
                        ? 'text-emerald-400'
                        : auditResult.status === 'FLAGGED'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {auditResult.status === 'PASS' && (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        <span>合规通过 (PASS)</span>
                      </>
                    )}
                    {auditResult.status === 'FLAGGED' && (
                      <>
                        <AlertTriangle className="h-5 w-5" />
                        <span>需要人工复核 (FLAGGED)</span>
                      </>
                    )}
                    {auditResult.status === 'BLOCKED' && (
                      <>
                        <ShieldAlert className="h-5 w-5" />
                        <span>高风险严禁发布 (BLOCKED)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">违规风险项</div>
                  <div className="text-2xl font-mono font-bold text-white">
                    {auditResult.violations.length} 条
                  </div>
                </div>
              </div>

              {auditResult.violations.length > 0 ? (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {auditResult.violations.map((v: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className={v.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}>
                          [{v.category.toUpperCase()}] {v.ruleName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{v.ruleCode}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{v.explanation}</p>
                      {v.suggestion && (
                        <div className="text-cyan-400 text-[11px] pt-1">
                          整改建议: {v.suggestion}
                        </div>
                      )}
                      {v.officialSourceUrl && (
                        <a
                          href={v.officialSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors pt-0.5"
                        >
                          <span>查看官方准则文档</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300">
                  未检测到任何命中违规规则的敏感项、过度堆砌或自动化风险。
                </div>
              )}

              <p className="text-[10px] text-slate-500 italic">{auditResult.disclaimer}</p>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <ShieldCheck className="h-10 w-10 text-slate-600" />
              <p className="text-xs">在左侧输入推文草稿并点击“执行合规审核”</p>
            </div>
          )}
        </div>
      </div>

      {/* Rules Knowledge Base Browser */}
      <div className="frost-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-cyan-400" />
            <span>可更新合规规则库 (Official Knowledge Base)</span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              {loadingRules ? '加载中...' : `共收录 ${rules.length} 条正式规则`}
            </span>
            <button
              onClick={() => setShowAddRule(prev => !prev)}
              className="flex items-center gap-1 rounded-lg bg-cyan-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新增 / 更新规则</span>
            </button>
          </div>
        </div>

        {showAddRule && (
          <form
            onSubmit={handleSaveRule}
            className="rounded-xl border border-cyan-500/25 bg-slate-900/70 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"
          >
            <input
              type="text"
              required
              placeholder="规则编号，例如 X-CUSTOM-01"
              value={newRule.code}
              onChange={e => setNewRule({ ...newRule, code: e.target.value })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
            />
            <input
              type="text"
              required
              placeholder="规则名称"
              value={newRule.name}
              onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
            />
            <select
              value={newRule.severity}
              onChange={e => setNewRule({ ...newRule, severity: e.target.value })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
            >
              <option value="warning">需人工复核 (warning)</option>
              <option value="critical">严禁发布 (critical)</option>
            </select>
            <input
              type="text"
              placeholder="关键词（逗号分隔）"
              value={newRule.keywords}
              onChange={e => setNewRule({ ...newRule, keywords: e.target.value })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200"
            />
            <input
              type="text"
              placeholder="官方来源链接"
              value={newRule.officialSourceUrl}
              onChange={e => setNewRule({ ...newRule, officialSourceUrl: e.target.value })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 md:col-span-2"
            />
            <textarea
              required
              rows={2}
              placeholder="规则说明与触发条件"
              value={newRule.description}
              onChange={e => setNewRule({ ...newRule, description: e.target.value })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 md:col-span-3"
            />
            <div className="md:col-span-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddRule(false)}
                className="rounded-lg px-3 py-1.5 text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={savingRule}
                className="rounded-lg bg-cyan-600 px-4 py-1.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {savingRule ? '保存中...' : '保存规则到知识库'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-300">
                    {rule.code}
                  </span>
                  <span
                    className={`font-semibold ${
                      rule.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    {rule.severity === 'critical' ? '严禁发布' : '需人工复核'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-200">{rule.name}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                  {rule.description}
                </p>
              </div>

              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[10px] text-slate-500">
                <span>地区: {rule.region} · v{rule.ruleVersion}</span>
                {rule.officialSourceUrl && (
                  <a
                    href={rule.officialSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 text-cyan-400 hover:underline"
                  >
                    <span>官方条款</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
