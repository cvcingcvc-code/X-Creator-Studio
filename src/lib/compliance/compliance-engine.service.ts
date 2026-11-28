import { getDb } from '@/lib/db/client';
import { ComplianceAuditResult, ComplianceRule } from '@/types';

export interface AuditTargetInput {
  text: string;
  creatorHandle?: string;
  hasAutoPublishRequested?: boolean;
  hashtags?: string[];
  mentions?: string[];
  targetUrl?: string;
}

export class ComplianceEngineService {
  /**
   * 获取所有启用的合规规则
   */
  public static getActiveRules(): ComplianceRule[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM compliance_rules WHERE is_active = 1 ORDER BY severity DESC
    `).all() as any[];

    return rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      severity: r.severity,
      description: r.description,
      region: r.region,
      officialSourceUrl: r.official_source_url,
      ruleVersion: r.rule_version,
      regexPattern: r.regex_pattern,
      keywords: JSON.parse(r.keywords || '[]'),
      isActive: Boolean(r.is_active),
      updatedAt: r.updated_at
    }));
  }

  /**
   * 新增或更新合规规则（支持规则库动态维护）
   */
  public static upsertRule(input: {
    id?: string;
    code: string;
    name: string;
    category: string;
    severity: 'warning' | 'critical' | 'info';
    description: string;
    region?: string;
    officialSourceUrl?: string;
    ruleVersion?: string;
    regexPattern?: string;
    keywords?: string[];
    isActive?: boolean;
  }): ComplianceRule {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id, created_at FROM compliance_rules WHERE code = ?').get(input.code) as
      | { id: string; created_at: string }
      | undefined;

    const id = existing?.id || input.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const region = input.region || 'Global';
    const officialSourceUrl = input.officialSourceUrl || 'https://help.x.com/en/rules-and-policies';
    const ruleVersion = input.ruleVersion || '2026.2';
    const regexPattern = input.regexPattern || '';
    const keywords = input.keywords || [];
    const isActive = input.isActive !== false ? 1 : 0;

    if (existing) {
      db.prepare(`
        UPDATE compliance_rules
        SET name = ?, category = ?, severity = ?, description = ?, region = ?,
            official_source_url = ?, rule_version = ?, regex_pattern = ?,
            keywords = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.name,
        input.category,
        input.severity,
        input.description,
        region,
        officialSourceUrl,
        ruleVersion,
        regexPattern,
        JSON.stringify(keywords),
        isActive,
        now,
        id
      );
    } else {
      db.prepare(`
        INSERT INTO compliance_rules (
          id, code, name, category, severity, description, region,
          official_source_url, rule_version, regex_pattern, keywords,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.code,
        input.name,
        input.category,
        input.severity,
        input.description,
        region,
        officialSourceUrl,
        ruleVersion,
        regexPattern,
        JSON.stringify(keywords),
        isActive,
        now,
        now
      );
    }

    return {
      id,
      code: input.code,
      name: input.name,
      category: input.category,
      severity: input.severity,
      description: input.description,
      region,
      officialSourceUrl,
      ruleVersion,
      regexPattern,
      keywords,
      isActive: Boolean(isActive),
      updatedAt: now
    };
  }

  /**
   * 执行全方位合规审核（3级评估：PASS / FLAGGED / BLOCKED）
   */
  public static auditContent(target: AuditTargetInput): ComplianceAuditResult {
    const rules = this.getActiveRules();
    const cleanText = target.text.trim();
    const lowerText = cleanText.toLowerCase();

    const violations: {
      ruleCode: string;
      ruleName: string;
      category: string;
      severity: 'warning' | 'critical' | 'info';
      matchedPattern?: string;
      explanation: string;
      officialSourceUrl?: string;
      suggestion: string;
    }[] = [];

    // 0. 强制安全准则：严禁开启未经人工审核的全自动发布
    if (target.hasAutoPublishRequested) {
      violations.push({
        ruleCode: 'X_AUTO_UNVERIFIED_MASS_POST',
        ruleName: '禁止全自动无确认发布',
        category: 'x_automation',
        severity: 'critical',
        explanation: 'X Automation Policy 明确禁止未经验证的全自动高频发推。系统必须保留人工审核确认环节。',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/x-automation',
        suggestion: '请关闭 auto_publish 标志，必须经过创作者人工点击确认后方可导出或发布。'
      });
    }

    // 1. 结构化特征检测 (X 平台规则)
    const hashtags = (cleanText.match(/#([\w\u4e00-\u9fa5]+)/g) || []);
    if (hashtags.length > 4) {
      violations.push({
        ruleCode: 'X_SPAM_HASHTAG_STUFFING',
        ruleName: '过度堆砌标签 (Hashtag Stuffing)',
        category: 'platform_spam',
        severity: 'warning',
        matchedPattern: `${hashtags.length} 个标签`,
        explanation: 'X 推荐算法对包含超过 3-4 个标签的帖子会显著降低权重甚至打上垃圾信息标记。',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/platform-manipulation',
        suggestion: '将标签精简至 1-2 个最具相关性的核心话题标签。'
      });
    }

    const mentions = (cleanText.match(/@([a-zA-Z0-9_]+)/g) || []);
    if (mentions.length > 3) {
      violations.push({
        ruleCode: 'X_SPAM_AGGRESSIVE_MENTION',
        ruleName: '侵入式批量艾特 (@Mention Spam)',
        category: 'x_automation',
        severity: 'critical',
        matchedPattern: `${mentions.length} 个艾特提及`,
        explanation: '在单条推文中艾特超过 3 个非互动用户涉嫌骚扰与虚假引流，极易导致账号封禁。',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/x-automation',
        suggestion: '移除无关的 @ 提及，仅保留直接对话或引用作者。'
      });
    }

    // 2. 规则库模式匹配（隐私、欺诈、版权、恶意言论等）
    for (const rule of rules) {
      // 正则检查
      if (rule.regexPattern) {
        try {
          const reg = new RegExp(rule.regexPattern, 'i');
          const m = reg.exec(cleanText);
          if (m) {
            violations.push({
              ruleCode: rule.code,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              matchedPattern: m[0].slice(0, 30),
              explanation: rule.description,
              officialSourceUrl: rule.officialSourceUrl,
              suggestion: this.getSuggestion(rule.category)
            });
            continue;
          }
        } catch {}
      }

      // 关键词命中检查
      if (rule.keywords && rule.keywords.length > 0) {
        for (const kw of rule.keywords) {
          if (lowerText.includes(kw.toLowerCase())) {
            violations.push({
              ruleCode: rule.code,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              matchedPattern: kw,
              explanation: rule.description,
              officialSourceUrl: rule.officialSourceUrl,
              suggestion: this.getSuggestion(rule.category)
            });
            break;
          }
        }
      }
    }

    // 3. 判定最终审核等级
    let overallStatus: 'PASS' | 'FLAGGED' | 'BLOCKED' = 'PASS';

    const hasCritical = violations.some(v => v.severity === 'critical');
    const hasWarning = violations.some(v => v.severity === 'warning');

    if (hasCritical) {
      overallStatus = 'BLOCKED';
    } else if (hasWarning) {
      overallStatus = 'FLAGGED';
    }

    return {
      status: overallStatus,
      violations,
      auditTimestamp: new Date().toISOString(),
      disclaimer: '合规审核引擎仅提供基于规则库的辅助风险排查，不构成任何形式的法律合规担保。发布前请创作者人工终审。'
    };
  }

  private static getSuggestion(category: string): string {
    switch (category) {
      case 'privacy':
        return '严禁泄露他人未经公开授权的手机号、身份证件、家庭住址或私人通讯录。请脱敏或彻底删除。';
      case 'fraud':
        return '避免使用“稳赚不赔”、“暴富”、“百分之百确定”等虚假误导承诺，务必提示投资或技术风险。';
      case 'harassment':
      case 'defamation':
        return '客观阐述技术与产品事实，禁止对特定个人或组织进行侮辱、人身攻击或无依据指控。';
      case 'x_automation':
      case 'platform_spam':
        return '遵守 X 官方自动化政策，保持自然的人机协同，避免批量机器刷帖或滥用提及。';
      default:
        return '请核实该内容的准确性与版权来源，必要时补充官方声明或原创声明。';
    }
  }
}
