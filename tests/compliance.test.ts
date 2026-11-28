import { describe, it, expect } from 'vitest';
import { ComplianceEngineService } from '../src/lib/compliance/compliance-engine.service';

describe('法律与平台规则审核引擎 (Compliance Engine)', () => {
  it('1. 正常专业创作内容判定为 PASS', () => {
    const normalText = '今天复盘一下独立开发产品的交付链路：核心在于快速跑通最小闭环。欢迎讨论你的经验！';
    const audit = ComplianceEngineService.auditContent({ text: normalText });

    expect(audit.status).toBe('PASS');
    expect(audit.violations.length).toBe(0);
  });

  it('2. 包含手机号码或个人隐私时被合规引擎严密拦截 (BLOCKED)', () => {
    const privacyLeak = '有兴趣的朋友直接联系我微信或者打电话：13812345678 私聊！';
    const audit = ComplianceEngineService.auditContent({ text: privacyLeak });

    expect(audit.status).toBe('BLOCKED');
    const privacyViolation = audit.violations.find((v: any) => v.category === 'privacy');
    expect(privacyViolation).toBeDefined();
    expect(privacyViolation?.severity).toBe('critical');
  });

  it('3. 虚假承诺、误导性欺诈（稳赚不赔）被坚决阻止发布 (BLOCKED)', () => {
    const fraudText = '加入我的会员社群，保证稳赚不赔，百分之百确定一个月财富自由！';
    const audit = ComplianceEngineService.auditContent({ text: fraudText });

    expect(audit.status).toBe('BLOCKED');
    const fraudViolation = audit.violations.find((v: any) => v.category === 'fraud');
    expect(fraudViolation).toBeDefined();
  });

  it('4. 尝试未经确认的全自动发推被自动化政策拦截 (BLOCKED)', () => {
    const normalText = '合规内容本身无问题';
    const audit = ComplianceEngineService.auditContent({
      text: normalText,
      hasAutoPublishRequested: true // 模拟自动发布
    });

    expect(audit.status).toBe('BLOCKED');
    expect(audit.violations[0].ruleCode).toBe('X_AUTO_UNVERIFIED_MASS_POST');
    expect(audit.violations[0].officialSourceUrl).toContain('x-automation');
  });

  it('5. 标签过度堆砌提示人工复核 (FLAGGED)', () => {
    const hashtagSpam = '分享一个工具 #AI #独立开发 #出海 #副业 #搞钱 #创业';
    const audit = ComplianceEngineService.auditContent({ text: hashtagSpam });

    expect(audit.status).toBe('FLAGGED');
    const spamViolation = audit.violations.find((v: any) => v.category === 'platform_spam');
    expect(spamViolation).toBeDefined();
    expect(spamViolation?.severity).toBe('warning');
  });

  it('6. 支持动态新增与更新可维护合规规则库并即时生效', () => {
    const rule = ComplianceEngineService.upsertRule({
      code: 'X-TEST-CUSTOM-01',
      name: '自定义敏感词测试规则',
      category: 'misleading_marketing',
      severity: 'warning',
      description: '用于验证规则库可更新性',
      keywords: ['内部保过名额']
    });

    expect(rule.code).toBe('X-TEST-CUSTOM-01');
    const audit = ComplianceEngineService.auditContent({ text: '限量发售内部保过名额，先到先得' });
    expect(audit.status).toBe('FLAGGED');
    expect(audit.violations.some((v: any) => v.ruleCode === 'X-TEST-CUSTOM-01')).toBe(true);
  });
});
