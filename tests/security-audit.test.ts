import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { enforceApiGuard, resetApiGuardForTests } from '../src/lib/security/api-guard';
import { assertSafeRemoteUrl, ImageHasher } from '../src/lib/originality/image-hasher';
import { validateSafeRegexPattern } from '../src/lib/compliance/compliance-engine.service';
import { escapeCsvCell } from '../src/lib/security/csv';
import { getPersistenceStatus } from '../src/lib/db/client';

describe('安全审计修复项专项验证 (P0/P1/P2)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetApiGuardForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetApiGuardForTests();
  });

  it('1. 启用 STUDIO_ACCESS_PASSCODE 后拒绝无口令或错误口令请求，正确口令放行', () => {
    process.env.STUDIO_ACCESS_PASSCODE = 'secret-studio-2026';

    const reqNoAuth = new NextRequest('http://localhost:3000/api/factory/batch', { method: 'POST' });
    const blocked1 = enforceApiGuard(reqNoAuth);
    expect(blocked1?.status).toBe(401);

    const reqWrong = new NextRequest('http://localhost:3000/api/factory/batch', {
      method: 'POST',
      headers: { 'x-studio-passcode': 'wrong' }
    });
    const blocked2 = enforceApiGuard(reqWrong);
    expect(blocked2?.status).toBe(401);

    const reqOk = new NextRequest('http://localhost:3000/api/factory/batch', {
      method: 'POST',
      headers: { 'x-studio-passcode': 'secret-studio-2026' }
    });
    const allowed = enforceApiGuard(reqOk);
    expect(allowed).toBeNull();
  });

  it('2. 每分钟限流护栏触发 429 拦截', () => {
    delete process.env.STUDIO_ACCESS_PASSCODE;
    process.env.API_RATE_LIMIT_PER_MIN = '2';

    const req = () => new NextRequest('http://localhost:3000/api/knowledge/import', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.10' }
    });

    expect(enforceApiGuard(req())).toBeNull();
    expect(enforceApiGuard(req())).toBeNull();
    const limited = enforceApiGuard(req());
    expect(limited?.status).toBe(429);
  });

  it('3. SSRF 防护拦截内网 IP、localhost、云元数据地址与非 HTTP 协议', async () => {
    await expect(assertSafeRemoteUrl('http://127.0.0.1:8080/secret')).rejects.toThrow('SSRF_BLOCKED');
    await expect(assertSafeRemoteUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('SSRF_BLOCKED');
    await expect(assertSafeRemoteUrl('http://localhost:3000/api/knowledge/export')).rejects.toThrow('SSRF_BLOCKED');
    await expect(assertSafeRemoteUrl('http://192.168.1.1/admin')).rejects.toThrow('SSRF_BLOCKED');
    await expect(assertSafeRemoteUrl('file:///etc/passwd')).rejects.toThrow('SSRF_BLOCKED');
  });

  it('4. 真实像素级感知哈希 dHash：同图转码 PNG vs JPEG 汉明距离极小，异图距离显著', async () => {
    // 构造左亮右暗横向渐变真实图像
    const width = 64;
    const height = 64;
    const gradA = Buffer.alloc(width * height * 3);
    const gradB = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const valA = Math.round((x / (width - 1)) * 255); // 左暗右亮
        const valB = 255 - valA; // 左亮右暗（完全相反梯度）
        gradA[idx] = gradA[idx + 1] = gradA[idx + 2] = valA;
        gradB[idx] = gradB[idx + 1] = gradB[idx + 2] = valB;
      }
    }

    const pngA = await sharp(gradA, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const jpgA = await sharp(gradA, { raw: { width, height, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
    const pngB = await sharp(gradB, { raw: { width, height, channels: 3 } }).png().toBuffer();

    const hashPngA = await ImageHasher.computeDHash(pngA);
    const hashJpgA = await ImageHasher.computeDHash(jpgA);
    const hashPngB = await ImageHasher.computeDHash(pngB);

    expect(ImageHasher.hammingDistance(hashPngA, hashJpgA)).toBeLessThanOrEqual(2);
    expect(ImageHasher.hammingDistance(hashPngA, hashPngB)).toBeGreaterThan(20);
  });

  it('5. ReDoS 防护拦截高危嵌套量词与反向引用，放行合法安全正则', () => {
    expect(validateSafeRegexPattern('(a+)+$').valid).toBe(false);
    expect(validateSafeRegexPattern('(.*)*foo').valid).toBe(false);
    expect(validateSafeRegexPattern('(abc)\\1').valid).toBe(false);
    expect(validateSafeRegexPattern('a'.repeat(205)).valid).toBe(false);
    expect(validateSafeRegexPattern('1[3-9]\\d{9}').valid).toBe(true);
  });

  it('6. CSV 公式注入防护为高危前缀添加前导单引号', () => {
    expect(escapeCsvCell('=CMD|\' /C calc\'!A0')).toMatch(/^'=CMD/);
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(escapeCsvCell('正常中文内容')).toBe('正常中文内容');
  });

  it('7. 云端无状态环境持久化告警准确识别', () => {
    process.env.VERCEL = '1';
    delete process.env.DATABASE_PATH;
    const status = getPersistenceStatus();
    expect(status.isEphemeralWarning).toBe(true);
    expect(status.warningMessage).toContain('持久化');
  });
});
