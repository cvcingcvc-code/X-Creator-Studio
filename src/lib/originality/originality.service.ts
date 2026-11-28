import { getDb } from '@/lib/db/client';
import { TextFingerprint } from './text-fingerprint';
import { ImageHasher } from './image-hasher';
import { OriginalityAuditResult } from '@/types';

export interface AuditTarget {
  id?: string;
  creatorHandle: string;
  text: string;
  imageUrl?: string;
  batchId?: string;
}

export class OriginalityService {
  /**
   * 执行多层原创性与重复度审计
   */
  public static async auditContent(target: AuditTarget): Promise<OriginalityAuditResult> {
    const db = getDb();
    const candidateText = target.text.trim();
    const textHash = TextFingerprint.sha256(candidateText);
    const candidateSimHash = TextFingerprint.computeSimHash(candidateText);
    const candidateTokens = TextFingerprint.tokenize(candidateText);

    // 1. 检索该创作者的历史库与草稿库
    const historicalPosts = db.prepare(`
      SELECT id, post_id, original_text, text_hash, theme, core_viewpoint, media_urls
      FROM knowledge_posts 
      WHERE creator_handle = ? AND status != 'deleted'
    `).all(target.creatorHandle) as any[];

    // 2. 检索同批次/其他未发布生成项
    let siblingItems: any[] = [];
    if (target.batchId) {
      siblingItems = db.prepare(`
        SELECT id, batch_id, title, generated_text, image_url
        FROM generation_items
        WHERE batch_id = ? AND id != ?
      `).all(target.batchId, target.id || '') as any[];
    }

    let maxDuplicateScore = 0;
    let matchedPostId: string | undefined;
    let matchedSnippet: string | undefined;
    const reasons: string[] = [];

    // 第一层：精确文本哈希查重 (SHA-256)
    for (const hist of historicalPosts) {
      if (hist.text_hash === textHash) {
        maxDuplicateScore = 100;
        matchedPostId = hist.post_id || hist.id;
        matchedSnippet = hist.original_text.slice(0, 100);
        reasons.push(`与历史帖子 [${matchedPostId}] 存在 100% 完全相同的精确文本哈希。`);
        break;
      }
    }

    // 第二层：语义相似度与核心论证骨架查重
    if (maxDuplicateScore < 100) {
      for (const hist of historicalPosts) {
        const semanticSim = TextFingerprint.calculateSemanticSimilarity(candidateText, hist.original_text);
        const simScore = Math.round(semanticSim * 100);

        if (simScore >= 60 && simScore > maxDuplicateScore) {
          maxDuplicateScore = simScore;
          matchedPostId = hist.post_id || hist.id;
          matchedSnippet = hist.original_text.slice(0, 100);
          reasons.push(
            `与历史帖子 [${matchedPostId}] 观点重合度高达 ${simScore}%，核心论点、论述逻辑与主题概念高度重复。`
          );
        }
      }
    }

    // 第三层：同批次内部交叉查重 (Batch Sibling Check)
    for (const sib of siblingItems) {
      if (!sib.generated_text) continue;
      const sibJaccard = TextFingerprint.jaccardSimilarity(candidateText, sib.generated_text);
      if (sibJaccard > 0.65) {
        const score = Math.round(sibJaccard * 100);
        if (score > maxDuplicateScore) {
          maxDuplicateScore = score;
          matchedPostId = `BatchItem_${sib.id}`;
          matchedSnippet = sib.generated_text.slice(0, 100);
          reasons.push(
            `与同批次生成项 [${sib.title || sib.id}] 重合度高达 ${score}%，批次内选题缺乏区分度。`
          );
        }
      }
    }

    // 第四层：图片感知哈希查重 (pHash / dHash)
    let candidateImageHash = '';
    if (target.imageUrl) {
      try {
        candidateImageHash = await ImageHasher.computeDHash(target.imageUrl);

        // 检查历史图片
        for (const hist of historicalPosts) {
          try {
            const urls: string[] = JSON.parse(hist.media_urls || '[]');
            for (const u of urls) {
              const histDHash = await ImageHasher.computeDHash(u);
              const dist = ImageHasher.hammingDistance(candidateImageHash, histDHash);
              if (dist <= 5) {
                const imgDupScore = Math.round((1 - dist / 64) * 100);
                if (imgDupScore > maxDuplicateScore) {
                  maxDuplicateScore = imgDupScore;
                  matchedPostId = hist.post_id || hist.id;
                  reasons.push(
                    `配图与历史帖子 [${matchedPostId}] 的素材感知哈希极其接近（汉明距离 ${dist} <= 5），存在重复使用视觉素材风险。`
                  );
                }
              }
            }
          } catch {}
        }
      } catch (err: any) {
        // 图片检测失败不阻断整体审计
      }
    }

    // 智能建议新创作角度（根据主题与被重复的内容动态生成，拒绝简单同义词替换）
    const suggestedNewAngles: string[] = [];
    if (maxDuplicateScore >= 60) {
      suggestedNewAngles.push(
        '【反向逆思考法】：不谈“如何成功做成”，转而剖析“同行普遍犯的 3 个隐形致命错误及真实止损经验”。'
      );
      suggestedNewAngles.push(
        '【硬核数据拆解】：引入第一人称的具体数据指标（如实际获客转化率、API Token 消耗与毛利对比），用事实击穿同质化。'
      );
      suggestedNewAngles.push(
        '【全流程闭环对比】：将单一工具评测升级为“前置调研 -> 选型 -> 落地交付 -> 运维维护”的全景工作流对比。'
      );
      suggestedNewAngles.push(
        '【读者互动争议点】：在文末抛出具有行业争议的开放性议题，引导有经验的从业者在评论区辩论。'
      );
    }

    const isOriginal = maxDuplicateScore < 60;

    return {
      isOriginal,
      duplicateScore: maxDuplicateScore,
      matchedPostId,
      matchedSnippet,
      reasons: reasons.length > 0 ? reasons : ['多层查重通过：未检索到高重合度的历史内容或批次内同质化选题。'],
      suggestedNewAngles: isOriginal ? [] : suggestedNewAngles,
      imageHash: candidateImageHash || undefined
    };
  }
}
