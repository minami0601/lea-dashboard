'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { TooltipProps } from 'recharts/types/component/Tooltip';

type MultiMetricDataPoint = {
  date: string;
  pageViews: number;
  registrationPageViews: number;
  newRegistrations: number;
  paidConversions: number;
  firstOrders: number;
};

type ChartComponentProps = {
  data: MultiMetricDataPoint[];
};

type PeriodType = 'daily' | 'weekly' | 'monthly';
type DateRange = {
  start: string;
  end: string;
};

type MetricKey = keyof Omit<MultiMetricDataPoint, 'date'>;

type DisplayDataPoint = {
  date: string;
  displayDate?: string;
} & {
  [K in MetricKey]?: number;
};

// 日付をYYYY-MM-DD形式に変換する関数
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 半年前の日付を取得する関数
const getSixMonthsAgo = (): string => {
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);
  return formatDateToString(sixMonthsAgo);
};

// 指標の設定
const metrics = [
  { key: 'pageViews' as MetricKey, name: 'ページビュー', color: '#8884d8' },
  { key: 'registrationPageViews' as MetricKey, name: '新規登録ページビュー', color: '#82ca9d' },
  { key: 'newRegistrations' as MetricKey, name: '新規登録数', color: '#ffc658' },
  { key: 'paidConversions' as MetricKey, name: '有料転換数', color: '#ff8042' },
  { key: 'firstOrders' as MetricKey, name: '初注文数', color: '#0088fe' },
];

export default function ChartComponent({ data }: ChartComponentProps) {
  const [isClient, setIsClient] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: getSixMonthsAgo(),
    end: formatDateToString(new Date()),
  });
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(metrics.map(m => m.key));

  // マウント後にクライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 期間タイプの変更ハンドラー
  const handlePeriodTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriodType(e.target.value as PeriodType);
  };

  // 日付範囲の変更ハンドラー
  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange((prev: DateRange) => ({
      ...prev,
      [name]: value,
    }));
  };

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

  // データのフィルタリング
  const filteredData = data.filter(item => {
    const itemDate = new Date(item.date);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    return itemDate >= startDate && itemDate <= endDate;
  });

  // 表示用のデータ加工
  const getDisplayData = (): DisplayDataPoint[] => {
    // 日次表示の場合
    if (periodType === 'daily') {
      return filteredData.map(item => {
        const date = new Date(item.date);
        const result: DisplayDataPoint = {
          date: item.date,
          displayDate: `${date.getMonth() + 1}/${date.getDate()}`
        };

        // 各指標の値をコピー
        metrics.forEach(metric => {
          result[metric.key] = item[metric.key];
        });

        return result;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // 週次表示用のデータ加工
    if (periodType === 'weekly') {
      // 週ごとにデータをグループ化
      const weeklyData: Record<string, MultiMetricDataPoint[]> = {};

      filteredData.forEach(item => {
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

      // 週ごとの平均値を計算
      return Object.entries(weeklyData).map(([weekStart, items]) => {
        const result: DisplayDataPoint = {
          date: weekStart,
          displayDate: `${new Date(weekStart).getMonth() + 1}/${new Date(weekStart).getDate()}週`
        };

        // 各指標の平均を計算
        metrics.forEach(metric => {
          const sum = items.reduce((acc: number, item) => {
            return acc + item[metric.key];
          }, 0);
          result[metric.key] = Math.round(sum / items.length);
        });

        return result;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // 月次表示の場合
    if (periodType === 'monthly') {
      const monthlyData: Record<string, MultiMetricDataPoint[]> = {};

      filteredData.forEach(item => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }

        monthlyData[monthKey].push(item);
      });

      return Object.entries(monthlyData).map(([monthKey, items]) => {
        const [year, month] = monthKey.split('-');
        const result: DisplayDataPoint = {
          date: `${year}-${month}-01`,
          displayDate: `${year}/${month}`
        };

        // 各指標の平均を計算
        metrics.forEach(metric => {
          const sum = items.reduce((acc: number, item) => {
            return acc + item[metric.key];
          }, 0);
          result[metric.key] = Math.round(sum / items.length);
        });

        return result;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return filteredData;
  };

  const displayData = getDisplayData();

  // サーバーサイドレンダリング時は何も表示しない
  if (!isClient) {
    return <div className="h-[400px] w-full"></div>;
  }

  // X軸のフォーマッター
  const formatXAxis = (dateStr: string) => {
    if (periodType === 'daily') {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } else if (periodType === 'weekly') {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}週`;
    } else {
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${d.getMonth() + 1}`;
    }
  };

  // ツールチップのラベルフォーマッター
  const formatTooltipLabel = (value: string) => {
    const d = new Date(value);
    if (periodType === 'daily') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } else if (periodType === 'weekly') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日週`;
    }
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  };

  // 値のフォーマッター
  const formatValue = (value: number) => {
    return value.toLocaleString();
  };

  const customTooltipFormatter = (value: number, name: string) => {
    const metric = metrics.find(m => m.key === name);
    return [formatValue(value), metric ? metric.name : name];
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-5">
        <div>
          <label htmlFor="periodType" className="mr-2.5">表示期間:</label>
          <select
            id="periodType"
            value={periodType}
            onChange={handlePeriodTypeChange}
            className="rounded border border-gray-300 px-2.5 py-1.5"
          >
            <option value="daily">日次</option>
            <option value="weekly">週次</option>
            <option value="monthly">月次</option>
          </select>
        </div>

        <div>
          <label htmlFor="startDate" className="mr-2.5">開始日:</label>
          <input
            type="date"
            id="startDate"
            name="start"
            value={dateRange.start}
            onChange={handleDateRangeChange}
            className="rounded border border-gray-300 px-2.5 py-1.5"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="mr-2.5">終了日:</label>
          <input
            type="date"
            id="endDate"
            name="end"
            value={dateRange.end}
            onChange={handleDateRangeChange}
            className="rounded border border-gray-300 px-2.5 py-1.5"
          />
        </div>
      </div>

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
        <ResponsiveContainer width="100%" height="100%">
          {React.createElement(LineChart, {
            data: displayData,
            margin: {
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            },
            children: [
              React.createElement(CartesianGrid, { strokeDasharray: "3 3", key: "grid" }),
              React.createElement(XAxis, {
                dataKey: "date",
                tickFormatter: formatXAxis,
                label: { value: '日付', position: 'insideBottomRight', offset: -10 },
                key: "xAxis"
              }),
              React.createElement(YAxis, {
                label: { value: '数値', angle: -90, position: 'insideLeft', offset: -5 },
                key: "yAxis"
              }),
              React.createElement(Tooltip as any, {
                formatter: customTooltipFormatter,
                labelFormatter: formatTooltipLabel,
                key: "tooltip"
              }),
              React.createElement(Legend as any, { key: "legend" }),
              ...metrics
                .filter(metric => activeMetrics.includes(metric.key))
                .map(metric =>
                  React.createElement(Line as any, {
                    type: "monotone",
                    dataKey: metric.key,
                    name: metric.name,
                    stroke: metric.color,
                    activeDot: { r: 8 },
                    key: metric.key
                  })
                )
            ]
          })}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
