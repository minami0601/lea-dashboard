import { Dashboard } from '../lib/sampleData';
import ChartComponent from '../components/ChartComponent';
import FunnelComponent from '../components/FunnelComponent';
import TrafficComponent from '../components/TrafficComponent';
import ChartComponent2 from '../components/ChartComponent2';
import { addDays, format, subDays } from 'date-fns';

// サンプルの複数メトリックデータを生成する関数
function generateMultiMetricData(days: number) {
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 基本値
    let pageViews = 5000 + Math.random() * 1000;
    let registrationPageViews = pageViews * 0.4 + Math.random() * 200;
    let newRegistrations = registrationPageViews * 0.2 + Math.random() * 50;
    let paidConversions = newRegistrations * 0.1 + Math.random() * 10;
    let firstOrders = paidConversions * 0.8 + Math.random() * 5;

    // 週末は値が下がる
    if (isWeekend) {
      pageViews *= 0.7;
      registrationPageViews *= 0.6;
      newRegistrations *= 0.5;
      paidConversions *= 0.4;
      firstOrders *= 0.3;
    }

    // 季節変動（月ごとの周期）
    const month = date.getMonth();
    const seasonalFactor = Math.sin((month / 12) * Math.PI * 2);

    pageViews *= (1 + seasonalFactor * 0.1);
    registrationPageViews *= (1 + seasonalFactor * 0.1);
    newRegistrations *= (1 + seasonalFactor * 0.1);
    paidConversions *= (1 + seasonalFactor * 0.1);
    firstOrders *= (1 + seasonalFactor * 0.1);

    result.push({
      date: dateStr,
      pageViews: Math.round(pageViews),
      registrationPageViews: Math.round(registrationPageViews),
      newRegistrations: Math.round(newRegistrations),
      paidConversions: Math.round(paidConversions),
      firstOrders: Math.round(firstOrders)
    });
  }

  return result;
}

async function fetchDashboardData(): Promise<Dashboard> {
  // 常に同じベースURLを使用
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/dashboard`, {
    cache: 'no-store' // SSRで毎回最新データを取得
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  return response.json();
}

export default async function Home() {
  // APIからデータを取得
  const dashboardData = await fetchDashboardData();

  // ChartComponent2用のサンプルデータを生成
  const multiMetricData = generateMultiMetricData(90);

  return (
    <div className="p-8 min-h-screen bg-white dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">LEA Dashboard</h1>

      {/* グラフセクション */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">グラフ</h2>
        <div className="grid grid-cols-12 gap-4 mb-8">
          {dashboardData.グラフ系.map((section, index) => (
            <div
              key={index}
              className={section.cols === '6' ? 'col-span-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800' : 'col-span-12 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800'}
            >
              <h3 className="text-xl font-medium mb-2 text-gray-800 dark:text-gray-200">{section.title}</h3>
              <div className="h-[650px] w-full">
                <ChartComponent
                  title={section.title}
                  data={section.data}
                  comparisonData={section.subData}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* トラフィックセクション */}
      <div className="my-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">HPへの流入内訳</h2>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800">
          <TrafficComponent trafficData={dashboardData.HPへの流入内訳} />
        </div>
      </div>

      {/* ファネルセクション */}
      <div className="my-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">コンバージョンファネル</h2>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800">
          {dashboardData.ファネル系.map((funnel, index) => (
            <FunnelComponent
              key={index}
              steps={funnel.data.map(stage => ({
                title: stage.title,
                value: stage.件数
              }))}
              overallConversionRate={funnel.prevPercent}
            />
          ))}
        </div>
      </div>

      {/* ChartComponent2セクション */}
      <div className="my-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">改良版グラフコンポーネント</h2>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800">
          <div className="h-[600px] w-full">
            <ChartComponent2 data={multiMetricData} />
          </div>
        </div>
      </div>
    </div>
  );
}
