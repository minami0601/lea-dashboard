'use client';

import React, { useState, useEffect } from 'react';
import { Dashboard } from '../lib/dashboardData';
import ChartComponent from '../components/ChartComponent';
import FunnelComponent from '../components/FunnelComponent';
import { format, subDays } from 'date-fns';

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

// ダッシュボードデータを取得する関数
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

// 日付をYYYY-MM-DD形式に変換する関数
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Home() {
  const [dashboardData, setDashboardData] = useState<Dashboard | null>(null);
  const [multiMetricData, setMultiMetricData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    start: (() => {
      // 初期値として3ヶ月前の日付を設定
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return formatDateToString(date);
    })(),
    end: formatDateToString(new Date()),
  });
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [isLoading, setIsLoading] = useState(true);

  // データを取得
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchDashboardData();
        setDashboardData(data);
        setMultiMetricData(generateMultiMetricData(90));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // 日付範囲の変更ハンドラー
  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 期間タイプの変更ハンドラー
  const handlePeriodTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPeriodType(e.target.value as 'daily' | 'weekly' | 'monthly');
  };

  if (isLoading || !dashboardData) {
    return <div className="p-8 min-h-screen bg-white dark:bg-gray-900">読み込み中...</div>;
  }

  return (
    <div className="p-8 min-h-screen bg-white dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">データ分析ダッシュボード</h1>

      {/* 日付範囲コントロール */}
      <div className="mt-4 mb-6 flex flex-wrap items-center gap-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <div>
          <label htmlFor="startDate" className="mr-2 text-sm">
            開始日:
          </label>
          <input
            type="date"
            id="startDate"
            name="start"
            value={dateRange.start}
            onChange={handleDateRangeChange}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="mr-2 text-sm">
            終了日:
          </label>
          <input
            type="date"
            id="endDate"
            name="end"
            value={dateRange.end}
            onChange={handleDateRangeChange}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </div>

        <div className="flex items-center ml-4">
          <span className="mr-3 text-sm">集計単位:</span>
          <div className="flex gap-3">
            <div className="flex items-center">
              <input
                type="radio"
                id="daily"
                name="periodType"
                value="daily"
                checked={periodType === 'daily'}
                onChange={handlePeriodTypeChange}
                className="mr-1"
              />
              <label htmlFor="daily" className="text-sm">日次</label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="weekly"
                name="periodType"
                value="weekly"
                checked={periodType === 'weekly'}
                onChange={handlePeriodTypeChange}
                className="mr-1"
              />
              <label htmlFor="weekly" className="text-sm">週次</label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="monthly"
                name="periodType"
                value="monthly"
                checked={periodType === 'monthly'}
                onChange={handlePeriodTypeChange}
                className="mr-1"
              />
              <label htmlFor="monthly" className="text-sm">月次</label>
            </div>
          </div>
        </div>
      </div>

      {/* グラフセクション */}
      <div className="mt-8">
        {/* <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">グラフ</h2> */}
        <div className="grid grid-cols-12 gap-4 mb-8">
          {dashboardData.グラフ系.map((section, index) => (
            <div
              key={index}
              className={section.cols === '6' ? 'col-span-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800' : 'col-span-12 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800'}
            >
              <div className="h-[550px] w-full">
                <ChartComponent
                  title={section.title}
                  data={section.data}
                  comparisonData={section.title === 'ファネル推移' ? [] : section.subData}
                  dateRange={dateRange}
                  periodType={periodType}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* トラフィックセクション */}
      {/* <div className="my-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">HPへの流入内訳</h2>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800">
          <TrafficComponent trafficData={dashboardData.HPへの流入内訳} />
        </div>
      </div> */}

      {/* ファネルセクション */}
      <div className="my-8">
        {/* <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">ファネル</h2> */}
        <div>
          {dashboardData.ファネル系.map((funnel, index) => (
            <FunnelComponent
              key={index}
              steps={funnel.data.map(stage => ({
                title: stage.title,
                value: stage.件数,
                comparisonData: stage.subData
              }))}
              overallConversionRate={funnel.prevPercent}
              dateRange={dateRange}
              title={funnel.title}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
