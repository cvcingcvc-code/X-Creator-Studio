import { NextRequest, NextResponse } from 'next/server';
import { SearchOrchestratorService } from '@/lib/search/search-orchestrator.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || 'AI 独立开发 创作者';
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const result = await SearchOrchestratorService.executeSearch(query, { limit });
  const providers = SearchOrchestratorService.getProvidersStatus();

  return NextResponse.json({
    ...result,
    availableProviders: providers
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query || 'AI 独立开发 商业化';
    const limit = body.limit || 15;
    const enabledProviders = body.enabledProviders;

    const result = await SearchOrchestratorService.executeSearch(query, {
      limit,
      enabledProviders
    });

    const providers = SearchOrchestratorService.getProvidersStatus();

    return NextResponse.json({
      ...result,
      availableProviders: providers
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
