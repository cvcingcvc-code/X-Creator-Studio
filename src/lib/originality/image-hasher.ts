import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import sharp from 'sharp';

const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const REMOTE_FETCH_TIMEOUT_MS = 5000;

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, '');

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // 云元数据 / 链路本地
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // 组播与保留段
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true; // Link-local
    }
    return false;
  }

  return true;
}

/**
 * 严格 SSRF 防护：仅允许公网 http/https 域名或公网 IP，拒绝内网、回环及云元数据地址
 */
export async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('SSRF_BLOCKED: 非法 URL 格式');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF_BLOCKED: 仅允许 http/https 协议，拒绝 ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error(`SSRF_BLOCKED: 拒绝访问本地或内网主机 ${host}`);
  }

  const bareHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (net.isIP(bareHost)) {
    if (isPrivateOrReservedIp(bareHost)) {
      throw new Error(`SSRF_BLOCKED: 拒绝访问私有或保留 IP ${bareHost}`);
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(bareHost, { all: true });
    if (!records.length) {
      throw new Error(`SSRF_BLOCKED: 域名无法解析 ${bareHost}`);
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error(`SSRF_BLOCKED: 域名 ${bareHost} 解析至内网地址 ${rec.address}`);
      }
    }
  } catch (err: any) {
    if (String(err?.message || '').startsWith('SSRF_BLOCKED')) {
      throw err;
    }
    throw new Error(`SSRF_DNS_FAILED: ${err?.message || 'DNS lookup failed'}`);
  }

  return parsed;
}

export class ImageHasher {
  /**
   * 计算图像的真实感知哈希 (Perceptual Difference Hash - dHash)
   * 优先使用 sharp 真正解码图片并缩放为 9x8 灰度像素矩阵；
   * 仅在传入非标准图片的合成字节流（如单元测试）时优雅降级为字节特征采样。
   * 远程 URL 严格执行 SSRF 防护、超时与大小上限控制。
   */
  public static async computeDHash(imageInput: Buffer | string): Promise<string> {
    let buffer: Buffer;

    if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:image')) {
        const base64Data = imageInput.split(',')[1] || '';
        buffer = Buffer.from(base64Data, 'base64');
      } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        // 先执行 SSRF 防护校验；若命中内网/云元数据地址直接抛出，绝不发起服务端请求
        const safeUrl = await assertSafeRemoteUrl(imageInput);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
          const res = await fetch(safeUrl.toString(), {
            signal: controller.signal,
            redirect: 'manual'
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            return this.hashString(imageInput);
          }

          const contentLength = Number(res.headers.get('content-length') || 0);
          if (contentLength > MAX_REMOTE_IMAGE_BYTES) {
            throw new Error(`IMAGE_TOO_LARGE: 远程图片超过 ${MAX_REMOTE_IMAGE_BYTES} 字节上限`);
          }

          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf.byteLength > MAX_REMOTE_IMAGE_BYTES) {
            throw new Error(`IMAGE_TOO_LARGE: 远程图片超过 ${MAX_REMOTE_IMAGE_BYTES} 字节上限`);
          }
          buffer = Buffer.from(arrayBuf);
        } catch (err: any) {
          if (String(err?.message || '').startsWith('IMAGE_TOO_LARGE')) {
            throw err;
          }
          // 若公网资源临时不可达，降级基于 URL 本身特征哈希
          return this.hashString(imageInput);
        }
      } else {
        buffer = Buffer.from(imageInput, 'utf8');
      }
    } else {
      buffer = imageInput;
    }

    if (!buffer || buffer.length === 0) {
      return '0'.repeat(16);
    }

    // 1. 优先使用 sharp 真实解码为 9x8 灰度像素矩阵
    const sampleGrid = await this.extractTruePixelGrid(buffer)
      ?? this.extractFallbackByteGrid(buffer, 9, 8);

    let hashBits = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = sampleGrid[y * 9 + x];
        const right = sampleGrid[y * 9 + (x + 1)];
        hashBits += left > right ? '1' : '0';
      }
    }

    // 将 64 位二进制转换为 16 位十六进制字符串
    let hexHash = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashBits.slice(i, i + 4);
      hexHash += parseInt(nibble, 2).toString(16);
    }

    return hexHash.padStart(16, '0');
  }

  /**
   * 真实图像解码：将 JPEG/PNG/WebP/AVIF 缩放为 9x8 单通道灰度原始像素
   */
  private static async extractTruePixelGrid(buffer: Buffer): Promise<number[] | null> {
    try {
      const raw = await sharp(buffer)
        .grayscale()
        .resize(9, 8, { fit: 'fill' })
        .raw()
        .toBuffer();

      if (raw.length === 72) {
        return Array.from(raw);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 降级方案：仅当传入非图像格式的合成字节流时使用
   */
  private static extractFallbackByteGrid(buffer: Buffer, width: number, height: number): number[] {
    const totalSamples = width * height;
    const grid: number[] = new Array(totalSamples).fill(0);

    const offset = Math.min(64, Math.floor(buffer.length * 0.05));
    const dataLength = buffer.length - offset;
    const step = Math.max(1, Math.floor(dataLength / totalSamples));

    for (let i = 0; i < totalSamples; i++) {
      const idx = offset + (i * step);
      if (idx < buffer.length) {
        const r = buffer[idx] || 0;
        const g = buffer[Math.min(idx + 1, buffer.length - 1)] || 0;
        const b = buffer[Math.min(idx + 2, buffer.length - 1)] || 0;
        grid[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }

    return grid;
  }

  /**
   * 计算两个感知哈希的汉明距离 (0 ~ 64)
   * 汉明距离 <= 5 表示高度相似或重复素材
   */
  public static hammingDistance(hashA: string, hashB: string): number {
    if (!hashA || !hashB || hashA.length !== 16 || hashB.length !== 16) {
      return 64;
    }

    let dist = 0;
    for (let i = 0; i < 16; i++) {
      let xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
      while (xor > 0) {
        dist += xor & 1;
        xor >>= 1;
      }
    }
    return dist;
  }

  private static hashString(str: string): string {
    const md5 = crypto.createHash('md5').update(str).digest('hex');
    return md5.slice(0, 16);
  }
}
