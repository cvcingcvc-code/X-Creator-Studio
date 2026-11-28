import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraphService } from '@/lib/knowledge/knowledge-graph.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle') || '@creator';

  const graph = KnowledgeGraphService.generateGraph(handle);
  return NextResponse.json(graph);
}
