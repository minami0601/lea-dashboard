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

// 時系列データの型
interface TimeSeriesData {
  date: string;
  value: number;
}

// グラフデータセットの型
interface GraphDataSet {
  title: string;
  data: TimeSeriesData[];
}

// 比較データの型
type ComparisonPeriod = '前日比' | '前週比' | '前月比';
type ComparisonDirection = 'up' | 'down' | 'same';

interface ComparisonData {
  title: ComparisonPeriod;
  percent: number;
  diff: ComparisonDirection;
}

// チャートコンポーネントのプロップス
interface ChartComponentProps {
  title: string;
  data: GraphDataSet[];
  comparisonData: ComparisonData[];
}

type PeriodType = 'daily' | 'weekly' | 'monthly';
type DateRange = {
  start: string;
  end: string;
};

// 日付をYYYY-MM-DD形式に変換する関数
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 日付関連のユーティリティ関数
const getSixMonthsAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return formatDateToString(date);
};

const getThreeMonthsAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return formatDateToString(date);
};

const getOneMonthAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return formatDateToString(date);
};

// 指標の色を定義
const colors = [
  '#8884d8', // 紫
  '#82ca9d', // 緑
  '#ffc658', // 黄色
  '#ff8042', // オレンジ
  '#0088fe', // 青
];

export default function ChartComponent({ title, data, comparisonData }: ChartComponentProps) {
  const [isClient, setIsClient] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: getSixMonthsAgo(),
    end: formatDateToString(new Date()),
  });
  const [activeDataSets, setActiveDataSets] = useState<string[]>(
    data.map(dataset => dataset.title)
  );

  // マウント後にクライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 期間タイプの変更ハンドラー
  const handlePeriodTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriodType(e.target.value as PeriodType);
  };

  // 日付範囲の変更ハンドラー
  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const [start, end] = value.split('|');
    setDateRange({ start, end });
  };

  // データセットの表示/非表示を切り替えるハンドラー
  const handleDataSetToggle = (dataSetTitle: string) => {
    setActiveDataSets((prev: string[]) => {
      if (prev.includes(dataSetTitle)) {
        return prev.filter((title: string) => title !== dataSetTitle);
      } else {
        return [...prev, dataSetTitle];
      }
    });
  };

  // データのフィルタリングと加工
  const processData = () => {
    // 各データセットをフィルタリング
    const filteredDataSets = data.map(dataset => {
      return {
        ...dataset,
        data: dataset.data.filter(item => {
          const itemDate = new Date(item.date);
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          return itemDate >= startDate && itemDate <= endDate;
        })
      };
    });

    if (periodType === 'weekly') {
      // 週ごとにデータをグループ化
      return groupDataByPeriod(filteredDataSets, 'week');
    } else if (periodType === 'monthly') {
      // 月ごとにデータをグループ化
      return groupDataByPeriod(filteredDataSets, 'month');
    } else if (periodType === 'daily') {
      // 日次データをそのまま返す
      return convertToChartFormat(filteredDataSets);
    }

    // デフォルトは日次データ
    return convertToChartFormat(filteredDataSets);
  };

  // 週または月ごとにデータをグループ化する関数
  const groupDataByPeriod = (dataSets: GraphDataSet[], periodType: 'week' | 'month') => {
    // 全データセットの日付を集める
    const allDates = dataSets.flatMap(dataset =>
      dataset.data.map(item => item.date)
    );

    // 重複を排除
    const uniqueDates = [...new Set(allDates)].sort();

    // 期間ごとのグループを作成
    const periodGroups: Record<string, string[]> = {};

    uniqueDates.forEach(dateStr => {
      const date = new Date(dateStr);
      let periodKey: string;

      if (periodType === 'week') {
        // 週の始まり（日曜日）を計算
        const day = date.getDay();
        const diff = date.getDate() - day;
        const weekStart = new Date(date);
        weekStart.setDate(diff);
        periodKey = formatDateToString(weekStart);
      } else {
        // 月の始まりを計算
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!periodGroups[periodKey]) {
        periodGroups[periodKey] = [];
      }

      periodGroups[periodKey].push(dateStr);
    });

    // 各期間ごとに平均値を計算
    const result: Record<string, Record<string, number>> = {};

    Object.entries(periodGroups).forEach(([periodKey, dates]) => {
      result[periodKey] = {};

      dataSets.forEach(dataset => {
        const relevantData = dataset.data.filter(item => dates.includes(item.date));
        if (relevantData.length > 0) {
          const sum = relevantData.reduce((acc, item) => acc + item.value, 0);
          result[periodKey][dataset.title] = Math.round(sum / relevantData.length);
        }
      });
    });

    // チャート用のフォーマットに変換
    return Object.entries(result)
      .map(([date, values]) => ({
        date,
        ...values,
        displayDate: formatDisplayDate(date, periodType)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // 表示用の日付フォーマットを生成
  const formatDisplayDate = (dateStr: string, periodType: 'week' | 'month'): string => {
    const date = new Date(dateStr);
    if (periodType === 'week') {
      return `${date.getMonth() + 1}/${date.getDate()}週`;
    } else {
      return `${date.getFullYear()}/${date.getMonth() + 1}`;
    }
  };

  // データセットをチャート用のフォーマットに変換
  const convertToChartFormat = (dataSets: GraphDataSet[]) => {
    // 全データセットの日付を集める
    const allDates = dataSets.flatMap(dataset =>
      dataset.data.map(item => item.date)
    );

    // 重複を排除して並べ替え
    const uniqueDates = [...new Set(allDates)].sort();

    // 各日付ごとにデータを集約
    return uniqueDates.map(date => {
      const result: Record<string, any> = { date };

      dataSets.forEach(dataset => {
        const dataPoint = dataset.data.find(item => item.date === date);
        if (dataPoint) {
          result[dataset.title] = dataPoint.value;
        }
      });

      return result;
    });
  };

  // 比較データの矢印アイコンを取得
  const getDirectionIcon = (direction: ComparisonDirection): string => {
    switch (direction) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'same':
        return '→';
      default:
        return '';
    }
  };

  // 比較データの色を取得
  const getDirectionColor = (direction: ComparisonDirection): string => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'same':
        return 'text-gray-500';
      default:
        return '';
    }
  };

  const chartData = processData();

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

  // 値のフォーマット（パーセント表示対応）
  const formatValue = (value: number, datasetTitle?: string) => {
    // 解約率データの場合はパーセント表示
    if (datasetTitle && datasetTitle.includes('解約率')) {
      return `${value}%`;
    }

    // 通常の数値フォーマット
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  // サーバーサイドレンダリング時は何も表示しない
  if (!isClient) {
    return <div className="h-[400px] w-full"></div>;
  }

  // ツールチップのカスタムフォーマッタ
  const customTooltipFormatter = (value: ValueType, name: NameType) => {
    if (value === undefined) return [0, ''];

    // 解約率データの場合はパーセント表示
    if (name && name.toString().includes('解約率')) {
      return [`${value}%`, name];
    }

    return [formatValue(Number(value)), name];
  };

  return (
    <div className="chart-container">
      <div className="mb-4 flex flex-wrap items-center justify-between">
        <h3 className="text-xl font-bold">{title}</h3>

        {/* 比較データ表示 */}
        <div className="flex flex-wrap gap-2">
          {comparisonData.map((item, index) => (
            <div
              key={index}
              className="flex items-center rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800"
            >
              <span>{item.title}: </span>
              <span
                className={`ml-1 font-bold ${getDirectionColor(item.diff)}`}
              >
                {getDirectionIcon(item.diff)} {item.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* コントロール */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor="periodType" className="mr-2 text-sm">
            表示期間:
          </label>
          <select
            id="periodType"
            value={periodType}
            onChange={handlePeriodTypeChange}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="daily">日次</option>
            <option value="weekly">週次</option>
            <option value="monthly">月次</option>
          </select>
        </div>

        <div>
          <label htmlFor="dateRange" className="mr-2 text-sm">
            範囲:
          </label>
          <select
            id="dateRange"
            value={`${dateRange.start}|${dateRange.end}`}
            onChange={handleDateRangeChange}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value={`${getSixMonthsAgo()}|${formatDateToString(new Date())}`}>
              過去6ヶ月
            </option>
            <option value={`${getThreeMonthsAgo()}|${formatDateToString(new Date())}`}>
              過去3ヶ月
            </option>
            <option value={`${getOneMonthAgo()}|${formatDateToString(new Date())}`}>
              過去1ヶ月
            </option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.map((dataset) => (
            <button
              key={dataset.title}
              onClick={() => handleDataSetToggle(dataset.title)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                activeDataSets.includes(dataset.title)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              {dataset.title}
            </button>
          ))}
        </div>
      </div>

      {/* チャート */}
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {React.createElement(LineChart, {
            data: chartData,
            margin: { top: 20, right: 30, left: 20, bottom: 20 },
            children: [
              React.createElement(CartesianGrid, {
                strokeDasharray: "3 3",
                key: "grid"
              }),
              React.createElement(XAxis, {
                dataKey: "date",
                height: 60,
                tickFormatter: formatXAxis,
                label: { value: '日付', position: 'insideBottomRight', offset: -10 },
                key: "xAxis"
              }),
              React.createElement(YAxis, {
                label: { value: title.includes('解約率') ? '解約率 (%)' : '数値', angle: -90, position: 'insideLeft', offset: -5 },
                tickFormatter: (value: number) => title.includes('解約率') ? `${value}%` : formatValue(value),
                key: "yAxis"
              }),
              React.createElement(Tooltip as any, {
                formatter: customTooltipFormatter,
                labelFormatter: formatTooltipLabel,
                key: "tooltip"
              }),
              React.createElement(Legend as any, { key: "legend" }),
              ...data
                .filter(dataset => activeDataSets.includes(dataset.title))
                .map((dataset, index) =>
                  React.createElement(Line as any, {
                    type: "monotone",
                    dataKey: dataset.title,
                    name: dataset.title,
                    stroke: colors[index % colors.length],
                    activeDot: { r: 8 },
                    key: dataset.title
                  })
                )
            ]
          })}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
