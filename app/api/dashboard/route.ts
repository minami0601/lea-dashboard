import { NextResponse } from 'next/server';
import { generateDashboardData } from '@/lib/sampleData';

export async function GET() {
  try {
    // デモデータを生成
    const dashboardData = generateDashboardData();
    console.log(dashboardData.グラフ系[2].data[0].data);

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
