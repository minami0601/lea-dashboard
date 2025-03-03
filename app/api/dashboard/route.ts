import { NextRequest, NextResponse } from 'next/server';
import { generateDashboardData } from '@/lib/dashboardData';

export async function GET(request: NextRequest) {
  try {
    // デモデータを生成（非同期関数になったので await を追加）
    const dashboardData = await generateDashboardData();

    // JSONレスポンスとして返す
    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'データの取得に失敗しました' },
      { status: 500 }
    );
  }
}
