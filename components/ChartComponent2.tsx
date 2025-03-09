'use client';

import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  ChartOptions,
  ChartData,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Chart.jsの必要なコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  ChartLegend
);

type MultiMetricDataPoint = {
  date: string;
  pageViews: number;
  registrationPageViews: number;
  newRegistrations: number;
  paidConversions: number;
  firstOrders: number;
};

type PeriodType = 'daily' | 'weekly' | 'monthly';

type ChartComponentProps = {
  data: MultiMetricDataPoint[];
  periodType: PeriodType; // 親コンポーネントから集計単位を受け取る
};

type MetricKey = keyof Omit<MultiMetricDataPoint, 'date'>;

// 指標の設定
const metrics = [
  { key: 'pageViews' as MetricKey, name: 'ページビュー', color: '#8884d8' },
  { key: 'registrationPageViews' as MetricKey, name: '新規登録ページビュー', color: '#82ca9d' },
  { key: 'newRegistrations' as MetricKey, name: '新規登録数', color: '#ffc658' },
  { key: 'paidConversions' as MetricKey, name: '有料転換数', color: '#ff8042' },
  { key: 'firstOrders' as MetricKey, name: '初注文数', color: '#0088fe' },
];

export default function ChartComponent({ data, periodType }: ChartComponentProps) {
  const [isClient, setIsClient] = useState(false);
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(metrics.map(m => m.key));

  // マウント後にクライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 指標の表示/非表示を切り替えるハンドラー
  const handleMetricToggle = (metricKey: MetricKey) => {
    setActiveMetrics((prev: MetricKey[]) => {
      if (prev.includes(metricKey)) {
        return prev.filter((key: MetricKey) => key !== metricKey);
      } else {
        return [...prev, metricKey];
      }
    });
  };

  // 集計単位に応じたデータの処理
  const processedData = React.useMemo(() => {
    if (periodType === 'daily') {
      // 日次データはそのまま使用
      return data;
    } else if (periodType === 'weekly') {
      // 週次データの集計
      const weeklyData: Record<string, MultiMetricDataPoint[]> = {};

      data.forEach(item => {
        const date = new Date(item.date);
        // 週の始まり（日曜日）を計算
        const day = date.getDay();
        const diff = date.getDate() - day;
        const weekStart = new Date(date);
        weekStart.setDate(diff);

        const weekKey = formatDateToString(weekStart);

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = [];
        }

        weeklyData[weekKey].push(item);
      });

      // 週ごとの集計データを作成
      return Object.entries(weeklyData).map(([weekStart, items]) => {
        const result: any = { date: weekStart };

        // 各指標の合計を計算
        metrics.forEach(metric => {
          const sum = items.reduce((acc, item) => acc + item[metric.key], 0);
          result[metric.key] = sum;
        });

        return result;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (periodType === 'monthly') {
      // 月次データの集計
      const monthlyData: Record<string, MultiMetricDataPoint[]> = {};

      data.forEach(item => {
        const date = new Date(item.date);
        // 月の始めの日付をキーとして使用
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }

        monthlyData[monthKey].push(item);
      });

      // 月ごとの集計データを作成
      return Object.entries(monthlyData).map(([monthStart, items]) => {
        const result: any = { date: monthStart };

        // 各指標の合計を計算
        metrics.forEach(metric => {
          const sum = items.reduce((acc, item) => acc + item[metric.key], 0);
          result[metric.key] = sum;
        });

        return result;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return data;
  }, [data, periodType]);

  // Chart.js用のデータ形式に変換
  const chartData: ChartData<'line'> = {
    labels: processedData.map(d => formatDate(d.date)),
    datasets: metrics
      .filter(metric => activeMetrics.includes(metric.key))
      .map(metric => ({
        label: metric.name,
        data: processedData.map(d => d[metric.key] || 0),
        borderColor: metric.color,
        backgroundColor: metric.color,
        pointBackgroundColor: metric.color,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: metric.color,
        tension: 0.1,
      })),
  };

  // Chart.jsのオプション設定
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            const value = context.raw as number;
            return `${context.dataset.label}: ${value.toLocaleString()}`;
          },
          title: function(context) {
            const dateStr = processedData[context[0].dataIndex]?.date;
            if (!dateStr) return '';
            return formatTooltipLabel(dateStr);
          }
        }
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '日付',
        },
        grid: {
          display: true,
        },
      },
      y: {
        title: {
          display: true,
          text: '数値',
        },
        grid: {
          display: true,
        },
      },
    },
  };

  // サーバーサイドレンダリング時は何も表示しない
  if (!isClient) {
    return <div className="h-[400px] w-full"></div>;
  }

  // 日付をYYYY-MM-DD形式に変換する関数
  function formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 日付フォーマッター - 集計単位に応じて変更
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (periodType === 'daily') {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } else if (periodType === 'weekly') {
      return `${d.getMonth() + 1}/${d.getDate()}週`;
    } else {
      return `${d.getFullYear()}/${d.getMonth() + 1}`;
    }
  }

  // ツールチップのラベルフォーマッター - 集計単位に応じて変更
  function formatTooltipLabel(value: string) {
    const d = new Date(value);
    if (periodType === 'daily') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } else if (periodType === 'weekly') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日週`;
    } else {
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    }
  }

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2.5">表示する指標:</div>
        <div className="flex flex-wrap gap-4">
          {metrics.map(metric => (
            <label key={metric.key} className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={activeMetrics.includes(metric.key)}
                onChange={() => handleMetricToggle(metric.key)}
                className="mr-1.5"
              />
              <span
                className="mr-1.5 inline-block h-3 w-3"
                style={{ backgroundColor: metric.color }}
              ></span>
              {metric.name}
            </label>
          ))}
        </div>
      </div>

      <div className="h-[400px] w-full">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
