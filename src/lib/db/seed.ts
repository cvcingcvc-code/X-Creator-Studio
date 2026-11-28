import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export function computeSha256(text: string): string {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

/**
 * 初始化系统必需的官方合规规则知识库。
 * 严格遵循隐私与真实数据原则：绝不预置任何私人账号信息或虚构的历史帖子数据。
 */
export function seedInitialData(db: DatabaseSync): void {
  const now = new Date().toISOString();

  const existingRules = db.prepare('SELECT count(*) as count FROM compliance_rules').get() as { count: number };
  if (existingRules.count === 0) {
    const insertRule = db.prepare(`
      INSERT OR IGNORE INTO compliance_rules (
        id, code, name, category, severity, description, region,
        official_source_url, rule_version, regex_pattern, keywords,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rules = [
      {
        id: 'rule-autospam-1',
        code: 'X-AUTO-01',
        name: '禁止自动化刷量、刷赞与批量操纵互动',
        category: 'x_automation',
        severity: 'critical',
        description: '严禁使用脚本或自动化工具自动批量点赞、转发、刷粉、伪造互动或操纵趋势热点。所有发帖必须经过人工确认。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/x-automation',
        ruleVersion: '2026.1',
        regexPattern: '(自动刷粉|刷赞|批量回粉|低价粉丝|买推特粉|刷阅读量|机器刷评)',
        keywords: ['自动刷粉', '刷赞', '买粉丝', '操纵热点']
      },
      {
        id: 'rule-autospam-2',
        code: 'X-AUTO-02',
        name: '禁止无差别批量私信与艾特骚扰',
        category: 'x_automation',
        severity: 'critical',
        description: '严禁向不特定用户批量发送骚扰回复、推广私信或在推文中无关联大量 @ 其他账号。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/x-automation',
        ruleVersion: '2026.1',
        regexPattern: '(@[a-zA-Z0-9_]{1,15}\\s*){4,}',
        keywords: ['批量私信', '爆破艾特', '批量骚扰回复']
      },
      {
        id: 'rule-content-phishing',
        code: 'X-FRAUD-01',
        name: '欺诈与误导性金融营销拦截',
        category: 'fraud',
        severity: 'critical',
        description: '禁止发布承诺稳赚不赔、假冒空投代币、假冒官方客服、诱导泄露私钥助记词或虚假投资收益等欺诈与误导性营销内容。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/platform-manipulation',
        ruleVersion: '2026.1',
        regexPattern: '(稳赚不赔|免费领取空投代币|私钥助记词|保本高息|零风险暴富|内幕必涨)',
        keywords: ['稳赚不赔', '百分之百确定', '零风险暴富', '保本高息']
      },
      {
        id: 'rule-content-privacy',
        code: 'X-PRIVACY-01',
        name: '禁止泄露个人隐私与人肉搜索',
        category: 'privacy',
        severity: 'critical',
        description: '严禁未经明确授权发布他人的身份证号、护照、家庭住址、私人手机号、银行卡号或私密肖像信息。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/personal-information',
        ruleVersion: '2026.1',
        regexPattern: '((\\d{17}[0-9Xx])|(1[3-9]\\d{9}))',
        keywords: ['身份证号', '私人家庭住址', '人肉搜索', '开盒']
      },
      {
        id: 'rule-content-defamation',
        code: 'X-HARASS-01',
        name: '禁止诽谤造谣与人身攻击骚扰',
        category: 'defamation',
        severity: 'critical',
        description: '禁止针对特定个人或机构发布无事实依据的诽谤言论、恶意辱骂、仇恨言论或持续性骚扰。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/abusive-behavior',
        ruleVersion: '2026.1',
        regexPattern: '(滚出中国|去死吧|纯属骗子滚蛋|造谣诽谤)',
        keywords: ['去死吧', '人肉网暴']
      },
      {
        id: 'rule-content-copyright',
        code: 'X-COPY-01',
        name: '版权与肖像权核验提醒',
        category: 'copyright',
        severity: 'warning',
        description: '引用第三方付费报告全文、未授权影视/摄影作品或他人肖像时，需核验版权与肖像授权并注明合法来源。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/copyright-policy',
        ruleVersion: '2026.1',
        regexPattern: '(盗版资源|破解版下载|网盘打包搬运|未授权搬运)',
        keywords: ['盗版资源', '破解版下载', '未授权搬运']
      },
      {
        id: 'rule-misleading-marketing',
        code: 'X-MKT-01',
        name: '误导性营销与夸张宣传人工复核',
        category: 'misleading_marketing',
        severity: 'warning',
        description: '包含绝对化营销承诺（如“全网第一”“100%有效”“绝对合法”）的内容存在广告法与平台合规风险，需人工复核。',
        region: 'Global / CN / US',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies',
        ruleVersion: '2026.1',
        regexPattern: '(100%有效|全网第一|绝对合规|躺赚月入十万)',
        keywords: ['100%有效', '躺赚月入十万', '绝对无风险']
      },
      {
        id: 'rule-spam-hashtag',
        code: 'X-SPAM-01',
        name: '禁止过度堆砌标签与垃圾信息',
        category: 'platform_spam',
        severity: 'warning',
        description: 'X 平台政策限制在单条推文中堆砌超过 4 个无关话题标签或重复刷屏内容。',
        region: 'Global',
        officialSourceUrl: 'https://help.x.com/en/rules-and-policies/platform-manipulation',
        ruleVersion: '2026.1',
        regexPattern: '',
        keywords: []
      }
    ];

    for (const r of rules) {
      insertRule.run(
        r.id,
        r.code,
        r.name,
        r.category,
        r.severity,
        r.description,
        r.region,
        r.officialSourceUrl,
        r.ruleVersion,
        r.regexPattern,
        JSON.stringify(r.keywords),
        1,
        now,
        now
      );
    }
  }
}
