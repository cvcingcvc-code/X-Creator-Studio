import crypto from 'node:crypto';

export class TextFingerprint {
  /**
   * 生成规范化文本哈希（SHA-256）
   */
  public static sha256(text: string): string {
    const clean = text.trim().replace(/\s+/g, ' ').toLowerCase();
    return crypto.createHash('sha256').update(clean, 'utf8').digest('hex');
  }

  /**
   * 分词与 N-gram 生成器（支持中英文混合）
   */
  public static tokenize(text: string): string[] {
    const clean = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, ' ');
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    
    // 中文字符按 2-gram 字符切分，英文按单词切分
    const tokens: string[] = [];
    for (const w of words) {
      if (/[\u4e00-\u9fa5]/.test(w)) {
        if (w.length === 1) {
          tokens.push(w);
        } else {
          for (let i = 0; i < w.length - 1; i++) {
            tokens.push(w.slice(i, i + 2));
          }
        }
      } else {
        tokens.push(w);
      }
    }
    return tokens;
  }

  /**
   * 计算字符级与词汇级综合语义相似度 (0.0 ~ 1.0)
   * 专用于识别同义词替换、语序微调但核心论点、论述逻辑高度雷同的内容
   */
  public static calculateSemanticSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(this.tokenize(textA));
    const tokensB = new Set(this.tokenize(textB));

    let tokenIntersect = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) tokenIntersect++;
    }

    const tokenJaccard = (tokensA.size + tokensB.size - tokenIntersect) > 0
      ? tokenIntersect / (tokensA.size + tokensB.size - tokenIntersect)
      : 0;

    // 中文字符集重合率（防御同义词调换与语序倒装）
    const charsA = new Set(textA.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase());
    const charsB = new Set(textB.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase());

    let charIntersect = 0;
    for (const c of charsA) {
      if (charsB.has(c)) charIntersect++;
    }

    const minChars = Math.min(charsA.size, charsB.size);
    const charOverlap = minChars > 0 ? (charIntersect / minChars) : 0;

    // 核心技术/定位关键词交集检查
    const keyEntities = [
      'AI', '大模型', 'Claude', 'GPT', 'DeepSeek', '一人公司', '独立开发',
      '不上班', '收入', '营收', '迷茫', '出租屋', '掌控时间', '复盘', '踩坑',
      '出海', '增长', '自媒体', '工作流', 'SOP', '开源', '自动化'
    ];

    let entityHitsA = 0;
    let commonEntityHits = 0;
    for (const ent of keyEntities) {
      const inA = textA.includes(ent);
      const inB = textB.includes(ent);
      if (inA) entityHitsA++;
      if (inA && inB) commonEntityHits++;
    }

    const entityOverlap = entityHitsA > 0 ? (commonEntityHits / entityHitsA) : 0;

    // 综合加权评分: 0.3 * tokenJaccard + 0.4 * charOverlap + 0.3 * entityOverlap
    // 当核心实体和字符重合度高时，大幅提升相似度判定
    let combinedScore = (tokenJaccard * 0.3) + (charOverlap * 0.4) + (entityOverlap * 0.3);

    // 边界增益：若共有实体数 >= 3 且字符重合 > 0.55，说明是完全同构换皮
    if (commonEntityHits >= 3 && charOverlap >= 0.55) {
      combinedScore = Math.max(combinedScore, 0.72);
    }

    return Math.min(1.0, Number(combinedScore.toFixed(3)));
  }

  /**
   * 计算两个文本的 N-gram Jaccard 相似度 (0.0 ~ 1.0)
   */
  public static jaccardSimilarity(textA: string, textB: string): number {
    return this.calculateSemanticSimilarity(textA, textB);
  }

  /**
   * 64位 SimHash 算法实现（用于高效海量文本查重）
   */
  public static computeSimHash(text: string): string {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return '0'.repeat(16);

    const v = new Array(64).fill(0);

    for (const token of tokens) {
      const hash = crypto.createHash('md5').update(token, 'utf8').digest();
      for (let i = 0; i < 64; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        const bit = (hash[byteIndex] >> bitIndex) & 1;
        if (bit === 1) {
          v[i] += 1;
        } else {
          v[i] -= 1;
        }
      }
    }

    let fingerprint = '';
    for (let i = 0; i < 64; i += 4) {
      let nibble = 0;
      for (let j = 0; j < 4; j++) {
        if (v[i + j] > 0) {
          nibble |= (1 << (3 - j));
        }
      }
      fingerprint += nibble.toString(16);
    }

    return fingerprint;
  }

  /**
   * 计算两个 64位十六进制哈希的汉明距离 (0 ~ 64)
   */
  public static hammingDistance(hashA: string, hashB: string): number {
    if (hashA.length !== hashB.length) return 64;
    let dist = 0;
    for (let i = 0; i < hashA.length; i++) {
      let xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
      while (xor > 0) {
        dist += xor & 1;
        xor >>= 1;
      }
    }
    return dist;
  }
}
