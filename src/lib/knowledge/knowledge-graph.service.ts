import { getDb } from '@/lib/db/client';
import { KnowledgeGraphData } from '@/types';

export class KnowledgeGraphService {
  /**
   * 生成个人知识图谱与创作盲区分析
   * 若无数据，返回 hasData: false，严格不得伪造数据
   */
  public static generateGraph(creatorHandle: string): KnowledgeGraphData {
    const db = getDb();

    // 统计该创作者的有效历史创作记录
    const posts = db.prepare(`
      SELECT * FROM knowledge_posts 
      WHERE creator_handle = ? AND status != 'deleted'
      ORDER BY published_at DESC
    `).all(creatorHandle) as any[];

    if (!posts || posts.length === 0) {
      return {
        creatorHandle,
        totalPosts: 0,
        hasData: false,
        topicsDistribution: [],
        viewpointClusters: [],
        caseStudies: [],
        contentBlindspots: [
          '暂无历史创作数据，无法分析盲区。请先导入历史帖子或 Analytics 数据。'
        ],
        futureRecommendations: [
          '导入历史数据后，系统将自动基于过往高赞观点与未覆盖盲区生成选题建议。'
        ],
        updatedAt: new Date().toISOString()
      };
    }

    // 1. 统计主题与分类分布
    const categoryCountMap = new Map<string, number>();
    const keywordCountMap = new Map<string, number>();
    const viewpointList: { text: string; postCount: number; category: string }[] = [];
    const cases: { title: string; source: string; mentionCount: number }[] = [];

    let totalEngagements = 0;

    for (const post of posts) {
      const cat = post.category || '未分类';
      categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);

      totalEngagements += (post.likes || 0) + (post.replies || 0) + (post.retweets || 0);

      // 统计关键词
      try {
        const kws: string[] = JSON.parse(post.keywords || '[]');
        for (const kw of kws) {
          keywordCountMap.set(kw, (keywordCountMap.get(kw) || 0) + 1);
        }
      } catch {}

      // 提取观点
      if (post.core_viewpoint && post.core_viewpoint !== '未提取到核心观点') {
        const existingVP = viewpointList.find(v => v.text === post.core_viewpoint);
        if (existingVP) {
          existingVP.postCount++;
        } else {
          viewpointList.push({
            text: post.core_viewpoint,
            postCount: 1,
            category: cat
          });
        }
      }

      // 提取引用案例（从正文中识别常见案例词或特定产品）
      const caseMatches = post.original_text.match(/(?:例如|比如|案例|复盘|体验了)\s*([A-Za-z0-9_\u4e00-\u9fa5]{2,16})/g);
      if (caseMatches) {
        for (const cm of caseMatches) {
          const caseName = cm.replace(/^(例如|比如|案例|复盘|体验了)\s*/, '').trim();
          if (caseName.length > 1) {
            const existingCase = cases.find(c => c.title === caseName);
            if (existingCase) {
              existingCase.mentionCount++;
            } else {
              cases.push({
                title: caseName,
                source: post.original_url || `Post #${post.post_id}`,
                mentionCount: 1
              });
            }
          }
        }
      }
    }

    const totalPosts = posts.length;
    const topicsDistribution = Array.from(categoryCountMap.entries()).map(([topic, count]) => ({
      topic,
      count,
      percentage: Number(((count / totalPosts) * 100).toFixed(1))
    })).sort((a, b) => b.count - a.count);

    // 2. 识别内容盲区 (Content Blindspots)
    // 根据创作者设定的 target_niche 与实际发表分布做比对
    const creator = db.prepare('SELECT target_niche FROM creators WHERE handle = ?').get(creatorHandle) as { target_niche: string } | undefined;
    let targetNiches: string[] = ['AI 与一人创业', '产品踩坑与复盘', '年轻人出路探索', 'X与小红书打法'];
    if (creator && creator.target_niche) {
      try {
        targetNiches = JSON.parse(creator.target_niche);
      } catch {}
    }

    const blindspots: string[] = [];
    for (const niche of targetNiches) {
      const matchCount = posts.filter(p => 
        (p.theme && p.theme.includes(niche)) || 
        (p.category && p.category.includes(niche)) || 
        p.original_text.includes(niche)
      ).length;

      if (matchCount === 0) {
        blindspots.push(`定位方向【${niche}】目前为 0 篇沉淀，属于核心创作盲区，建议优先补足。`);
      } else if (matchCount <= 2 && totalPosts >= 5) {
        blindspots.push(`定位方向【${niche}】仅有 ${matchCount} 篇历史内容，深度与案例储备不足。`);
      }
    }

    // 检查是否缺少数据支撑/定量指标
    const withDataCount = posts.filter(p => /\d+(?:%|k|w|万|元|\$|次)/i.test(p.original_text)).length;
    if (withDataCount / totalPosts < 0.3) {
      blindspots.push('过往内容偏向宏观观点与情绪，缺乏真实运营数据、转化率、ROI 等硬核量化指标支撑。');
    }

    // 检查是否缺少互动式提问
    const withQuestionCount = posts.filter(p => p.original_text.includes('？') || p.original_text.includes('?')).length;
    if (withQuestionCount / totalPosts < 0.4) {
      blindspots.push('结尾开放式提问与同行互动比例低于 40%，未充分挖掘 X 算法的评论区权重。');
    }

    // 3. 未来可继续深入的选题建议 (Future Recommendations)
    const futureRecommendations: string[] = [];
    const topTopic = topicsDistribution[0]?.topic || 'AI 实践';
    futureRecommendations.push(`针对主力专长【${topTopic}】，从“工具评测”升级为“商业变现闭环与真实流水拆解”。`);
    
    if (cases.length > 0) {
      const topCase = cases[0].title;
      futureRecommendations.push(`围绕已被读者高度认可的案例【${topCase}】，产出进阶版的深度踩坑清单与源码级复盘。`);
    } else {
      futureRecommendations.push('增加真实产品构建案例（如从 0 到 1 搭建具体开源工具或微型 SaaS 的全程记录）。');
    }

    futureRecommendations.push('结合当前技术热点（如开源大模型、Claude 3.7 / Gemini 2.5 落地），探讨一人团队的杠杆效应。');
    futureRecommendations.push('设计对照实验型内容：对比传统开发流程与 AI 辅助开发在交付时间、BUG 率与运维成本上的真实差异。');

    return {
      creatorHandle,
      totalPosts,
      hasData: true,
      topicsDistribution,
      viewpointClusters: viewpointList.slice(0, 15),
      caseStudies: cases.slice(0, 10),
      contentBlindspots: blindspots.length > 0 ? blindspots : ['当前内容分布均衡，暂无明显盲区。'],
      futureRecommendations,
      updatedAt: new Date().toISOString()
    };
  }
}
