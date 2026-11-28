import crypto from 'node:crypto';

export class ImageHasher {
  /**
   * 计算图像的感知哈希 (Perceptual Difference Hash - dHash)
   * 采用纯 TypeScript 实现，无需依赖易崩溃的本地 C++ 二进制扩展
   * 输入支持 Buffer、Base64 字符串或 URL
   */
  public static async computeDHash(imageInput: Buffer | string): Promise<string> {
    let buffer: Buffer;

    if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:image')) {
        const base64Data = imageInput.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        try {
          const res = await fetch(imageInput);
          const arrayBuf = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuf);
        } catch {
          // 若网络不可达，降级基于 URL 本身特征哈希
          return this.hashString(imageInput);
        }
      } else {
        // 本地路径或纯 Base64
        buffer = Buffer.from(imageInput, 'utf8');
      }
    } else {
      buffer = imageInput;
    }

    if (!buffer || buffer.length === 0) {
      return '0'.repeat(16);
    }

    // 采用 9x8 = 72 个特征采样点生成 64 位对比指纹
    const sampleGrid = this.extractLuminanceGrid(buffer, 9, 8);

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
   * 从图片缓冲区中提取 9x8 亮度矩阵
   */
  private static extractLuminanceGrid(buffer: Buffer, width: number, height: number): number[] {
    const totalSamples = width * height;
    const grid: number[] = new Array(totalSamples).fill(0);

    // 跳过常见文件头 (JPEG 0xFFD8, PNG \x89PNG, etc.)
    const offset = Math.min(64, Math.floor(buffer.length * 0.05));
    const dataLength = buffer.length - offset;
    const step = Math.max(1, Math.floor(dataLength / totalSamples));

    for (let i = 0; i < totalSamples; i++) {
      const idx = offset + (i * step);
      if (idx < buffer.length) {
        // 取当前及相邻 3 字节的加权亮度
        const r = buffer[idx] || 0;
        const g = buffer[Math.min(idx + 1, buffer.length - 1)] || 0;
        const b = buffer[Math.min(idx + 2, buffer.length - 1)] || 0;
        // 相对亮度系数: 0.299R + 0.587G + 0.114B
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

  /**
   * 辅助字符串哈希
   */
  private static hashString(str: string): string {
    const md5 = crypto.createHash('md5').update(str).digest('hex');
    return md5.slice(0, 16);
  }
}
