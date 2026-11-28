// X-Creator-Studio 全局核心类型定义

// 1. 创作者画像与身份
export interface CreatorProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  joinedDate?: string;
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  monthlyImpressions?: string;
  engagementRate?: string;
  targetNiches?: string[];
  toneStyle?: string;
  defaultPublishMode?: 'manual_intent' | 'api';
  createdAt?: string;
  updatedAt?: string;
}

// 2. 长期个人创作知识库
export type PostStatus = 'published' | 'draft' | 'deleted' | 'archived';
export type PostSourceType = 'x_api' | 'csv' | 'json' | 'excel' | 'text' | 'manual' | 'x_import_archive' | 'analytics_csv' | 'json_export' | 'excel_file' | 'manual_entry';

export interface KnowledgePost {
  id: string;
  postId?: string;
  creatorHandle: string;
  originalText: string;
  textHash: string;
  publishedAt?: string;
  originalUrl?: string;
  mediaUrls?: string[];
  theme?: string;
  coreViewpoint?: string;
  expressionStyle?: string;
  sourceReferences?: string[];
  keywords?: string[];
  category?: string;
  impressions?: number;
  likes?: number;
  replies?: number;
  retweets?: number;
  sourceType: string;
  status: PostStatus;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportResult {
  totalProcessed: number;
  importedCount: number;
  skippedDuplicates: number;
  failedCount: number;
  errors: string[];
}

// 3. 个人知识图谱与盲区分析
export interface KnowledgeGraphData {
  creatorHandle: string;
  totalPosts: number;
  hasData: boolean;
  topicsDistribution: {
    topic: string;
    count: number;
    percentage: number;
  }[];
  viewpointClusters: {
    text: string;
    postCount: number;
    category: string;
  }[];
  caseStudies: {
    title: string;
    source: string;
    mentionCount: number;
  }[];
  contentBlindspots: string[];
  futureRecommendations: string[];
  updatedAt: string;
}

// 4. 原创性与多层查重系统
export interface OriginalityAuditResult {
  isOriginal: boolean;
  duplicateScore: number; // 0 - 100
  matchedPostId?: string;
  matchedSnippet?: string;
  reasons: string[];
  suggestedNewAngles: string[];
  imageHash?: string;
}

// 5. 真实联网搜索系统
export interface SearchItem {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt?: string;
  fetchedAt: string;
  credibilityScore: number;
  verified?: boolean;
  crossValidated?: boolean;
  validationCount?: number;
}

// 6. 法律与平台规则审核
export type ComplianceRating = 'PASS' | 'FLAGGED' | 'BLOCKED';

export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: 'warning' | 'critical' | 'info';
  description: string;
  region: string;
  officialSourceUrl?: string;
  ruleVersion: string;
  regexPattern?: string;
  keywords?: string[];
  isActive?: boolean;
  updatedAt?: string;
}

export interface ComplianceAuditResult {
  status: ComplianceRating;
  violations: {
    ruleCode: string;
    ruleName: string;
    category: string;
    severity: 'warning' | 'critical' | 'info';
    matchedPattern?: string;
    explanation: string;
    officialSourceUrl?: string;
    suggestion: string;
  }[];
  auditTimestamp: string;
  disclaimer: string;
}

// 7. 批量图文创作工厂
export type BatchCount = 1 | 5 | 10 | 20;

export interface GenerationItem {
  id: string;
  batchId: string;
  topic: string;
  angle: string;
  imagePrompt: string;
  imageUrl?: string;
  imageSource?: 'api_generated' | 'manual_uploaded' | 'unconfigured';
  generatedText: string;
  originalityScore: number;
  originalityStatus: 'passed' | 'flagged';
  originalityReasons?: string[];
  complianceStatus: ComplianceRating;
  complianceViolations?: string[];
  sources?: {
    title: string;
    url: string;
    source: string;
  }[];
  status: 'ready_for_review' | 'confirmed' | 'blocked';
  isConfirmed: boolean;
}

export interface CreationBatch {
  id: string;
  creatorHandle: string;
  batchCount: BatchCount;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
  progress: number;
  textModel: string;
  imageModel: string;
  textApiConfigured?: boolean;
  imageApiConfigured?: boolean;
  providerNotices?: string[];
  totalTokensUsed: number;
  estimatedCostUsd: number;
  items: GenerationItem[];
  createdAt: string;
  updatedAt: string;
}
