'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { SnowParticles } from '@/components/SnowParticles';
import { KnowledgeTab } from '@/components/tabs/KnowledgeTab';
import { OriginalityTab } from '@/components/tabs/OriginalityTab';
import { SearchRadarTab } from '@/components/tabs/SearchRadarTab';
import { FactoryTab } from '@/components/tabs/FactoryTab';
import { ComplianceTab } from '@/components/tabs/ComplianceTab';

const HANDLE_STORAGE_KEY = 'x_creator_studio_active_handle';

export default function Home() {
  const [activeTab, setActiveTab] = useState('knowledge');
  const [creatorHandle, setCreatorHandle] = useState('@creator');
  const [totalPosts, setTotalPosts] = useState(0);
  const [factoryTopic, setFactoryTopic] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HANDLE_STORAGE_KEY);
      if (saved && saved.trim()) {
        setCreatorHandle(saved.startsWith('@') ? saved.trim() : `@${saved.trim()}`);
      }
    } catch {}
  }, []);

  const handleChangeCreatorHandle = (nextHandle: string) => {
    const normalized = nextHandle.startsWith('@') ? nextHandle : `@${nextHandle}`;
    setCreatorHandle(normalized);
    try {
      window.localStorage.setItem(HANDLE_STORAGE_KEY, normalized);
    } catch {}
  };

  const refreshStats = async (handle = creatorHandle) => {
    try {
      const res = await fetch(`/api/knowledge/posts?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();
      setTotalPosts(data.total || 0);
    } catch {}
  };

  useEffect(() => {
    refreshStats(creatorHandle);
  }, [creatorHandle]);

  const handleUseTopicInFactory = (topicTitle: string) => {
    setFactoryTopic(topicTitle);
    setActiveTab('factory');
  };

  return (
    <div className="relative min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      {/* Winter Frost Particles */}
      <SnowParticles />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        creatorHandle={creatorHandle}
        onChangeHandle={handleChangeCreatorHandle}
        totalPosts={totalPosts}
      />

      {/* Main Content Workspace */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'knowledge' && (
          <KnowledgeTab
            creatorHandle={creatorHandle}
            onRefreshStats={() => refreshStats(creatorHandle)}
          />
        )}

        {activeTab === 'originality' && (
          <OriginalityTab creatorHandle={creatorHandle} />
        )}

        {activeTab === 'search' && (
          <SearchRadarTab onUseTopicInFactory={handleUseTopicInFactory} />
        )}

        {activeTab === 'factory' && (
          <FactoryTab
            creatorHandle={creatorHandle}
            initialTopic={factoryTopic}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceTab creatorHandle={creatorHandle} />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-md py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>X-Creator-Studio · 独立创作者智能运营工作台</span>
          <span>遵循 X 官方自动化政策与合规准则 · 默认人工终审确认 · 私人数据仅本地/私有库保存</span>
        </div>
      </footer>
    </div>
  );
}
