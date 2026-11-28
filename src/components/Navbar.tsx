'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Search,
  Layers,
  ShieldCheck,
  ExternalLink,
  Database,
  Radio,
  UserCheck,
  Check
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  creatorHandle: string;
  onChangeHandle: (handle: string) => void;
  totalPosts: number;
}

export function Navbar({
  activeTab,
  onSelectTab,
  creatorHandle,
  onChangeHandle,
  totalPosts
}: NavbarProps) {
  const [editingHandle, setEditingHandle] = useState(false);
  const [draftHandle, setDraftHandle] = useState(creatorHandle);

  const tabs = [
    { id: 'desk', label: '今日创作台', icon: Sparkles },
    { id: 'knowledge', label: '风格与知识库', icon: BookOpen, badge: `${totalPosts} 篇` },
    { id: 'originality', label: '原创性检测', icon: Sparkles },
    { id: 'search', label: '联网雷达', icon: Search },
    { id: 'factory', label: '批量工坊', icon: Layers },
    { id: 'compliance', label: '合规中心', icon: ShieldCheck }
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftHandle.trim().replace(/^@*/, '');
    if (!cleaned) return;
    onChangeHandle(`@${cleaned}`);
    setEditingHandle(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand & Editable Creator Workspace Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <span className="font-mono text-xl font-bold">X</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">X-Creator Studio</span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
                v2.0 生产级
              </span>
            </div>

            {editingHandle ? (
              <form onSubmit={handleSave} className="mt-0.5 flex items-center gap-1">
                <input
                  type="text"
                  value={draftHandle}
                  onChange={e => setDraftHandle(e.target.value)}
                  placeholder="@your_x_handle"
                  className="w-36 rounded-md border border-cyan-500/40 bg-slate-900 px-2 py-0.5 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="rounded-md bg-cyan-600 p-1 text-white hover:bg-cyan-500"
                  title="确认切换账号"
                >
                  <Check className="h-3 w-3" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                  onClick={() => {
                    setDraftHandle(creatorHandle);
                    setEditingHandle(true);
                  }}
                  className="flex items-center gap-1 text-slate-300 hover:text-cyan-300 transition-colors"
                  title="点击切换或绑定你的 X 账号空间"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{creatorHandle}</span>
                  <span className="text-[10px] text-slate-500">(切换)</span>
                </button>
                <a
                  href={`https://x.com/${creatorHandle.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-cyan-400/80 hover:text-cyan-300 transition-colors"
                >
                  主页 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-900/70 p-1 border border-slate-800/60">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Engine status indicators */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1">
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <span>SQLite WAL</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1">
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            <span>真实网络</span>
          </div>
        </div>
      </div>
    </header>
  );
}
