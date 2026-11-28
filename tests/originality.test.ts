import { describe, it, expect, beforeEach } from 'vitest';
import { TextFingerprint } from '../src/lib/originality/text-fingerprint';
import { ImageHasher } from '../src/lib/originality/image-hasher';
import { OriginalityService } from '../src/lib/originality/originality.service';
import { KnowledgeImporterService } from '../src/lib/knowledge/knowledge-importer.service';
import { getDb } from '../src/lib/db/client';

describe('原创性检测与图像感知哈希查重系统', () => {
  const testHandle = '@orig_test_creator';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM knowledge_posts WHERE creator_handle = ?').run(testHandle);
    db.prepare('DELETE FROM creators WHERE handle = ?').run(testHandle);

    // 录入一篇基础历史帖子
    KnowledgeImporterService.importPosts(testHandle, [{
      postId: 'hist_orig_1',
      originalText: '不上班的第 90 天：当代年轻人如何用 AI 搭建一人公司的第一笔收入？从迷茫到自己掌控时间的真实思考。',
      mediaUrls: ['https://example.com/frost-image-v1.jpg']
    }], 'manual');
  });

  it('1. 文本哈希与 SimHash 汉明距离计算准确', () => {
    const textA = '今天探讨独立开发者的出海增长策略';
    const textB = '今天探讨独立开发者的出海增长策略';
    const textC = '完全不同的话题：烘焙面包的温度控制技巧';

    const hashA = TextFingerprint.computeSimHash(textA);
    const hashB = TextFingerprint.computeSimHash(textB);
    const hashC = TextFingerprint.computeSimHash(textC);

    expect(TextFingerprint.hammingDistance(hashA, hashB)).toBe(0);
    expect(TextFingerprint.hammingDistance(hashA, hashC)).toBeGreaterThan(15);
  });

  it('2. 图像感知哈希 (dHash) 汉明距离精准检测素材重复', async () => {
    const sampleBuffer1 = Buffer.from('RIFF....WAVEfmt....IMAGE_DATA_SAMPLE_A_1234567890_VERY_LONG_BYTES_STREAM');
    const sampleBuffer2 = Buffer.from('RIFF....WAVEfmt....IMAGE_DATA_SAMPLE_A_1234567890_VERY_LONG_BYTES_STREAM');
    const sampleBuffer3 = Buffer.from('DIFF....BYTES_STREAM_TOTALLY_DIFFERENT_RGB_LUMINANCE_MATRIX_SAMPLE_12345');

    const hash1 = await ImageHasher.computeDHash(sampleBuffer1);
    const hash2 = await ImageHasher.computeDHash(sampleBuffer2);
    const hash3 = await ImageHasher.computeDHash(sampleBuffer3);

    expect(ImageHasher.hammingDistance(hash1, hash2)).toBe(0);
    expect(ImageHasher.hammingDistance(hash1, hash3)).toBeGreaterThan(5);
  });

  it('3. 改写后的相似观点内容能被多层查重有效识别', async () => {
    // 语义高度改写版：核心观点和论证角度一致
    const candidateSimilar = '不上班的三个月：年轻人如何借助 AI 建立一人公司的第一笔营收？从找工作的迷茫到自己把控节奏的深度复盘。';

    const audit = await OriginalityService.auditContent({
      creatorHandle: testHandle,
      text: candidateSimilar
    });

    expect(audit.isOriginal).toBe(false);
    expect(audit.duplicateScore).toBeGreaterThanOrEqual(60);
    expect(audit.reasons.length).toBeGreaterThan(0);
    expect(audit.suggestedNewAngles.length).toBeGreaterThan(0);
    expect(audit.suggestedNewAngles[0]).toContain('反向逆思考法');
  });

  it('4. 全新不同选题能够正常通过查重', async () => {
    const candidateUnique = '深度拆解：Next.js 15 的 React Server Actions 在高并发场景下的连接池管理与优雅降级方案。';

    const audit = await OriginalityService.auditContent({
      creatorHandle: testHandle,
      text: candidateUnique
    });

    expect(audit.isOriginal).toBe(true);
    expect(audit.duplicateScore).toBeLessThan(60);
  });
});
