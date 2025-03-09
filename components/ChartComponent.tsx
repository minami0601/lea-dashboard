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
  dateRange: {
    start: string;
    end: string;
  };
  periodType: 'daily' | 'weekly' | 'monthly';
}

// 日付をYYYY-MM-DD形式に変換する関数
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 指標の色を定義
const colors = [
  '#8884d8', // 紫
  '#82ca9d', // 緑
  '#ffc658', // 黄色
  '#ff8042', // オレンジ
  '#0088fe', // 青
];

export default function ChartComponent({ title, data, comparisonData, dateRange, periodType }: ChartComponentProps) {
  const [isClient, setIsClient] = useState(false);
  const [activeDataSets, setActiveDataSets] = useState<string[]>(
    data.map(dataset => dataset.title)
  );

  // マウント後にクライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

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

    // 各期間ごとに合計値を計算
    const result: Record<string, Record<string, number>> = {};

    Object.entries(periodGroups).forEach(([periodKey, dates]) => {
      result[periodKey] = {};

      dataSets.forEach(dataset => {
        const relevantData = dataset.data.filter(item => dates.includes(item.date));
        if (relevantData.length > 0) {
          const sum = relevantData.reduce((acc, item) => acc + item.value, 0);
          result[periodKey][dataset.title] = sum;
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

  // プロセスされたデータの型を明示的に定義
  type ChartDataItem = Record<string, any> & { date: string; displayDate?: string };
  const typedChartData = chartData as ChartDataItem[];

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

  // Chart.js用のデータ形式に変換
  const chartJsData: ChartData<'line'> = {
    labels: typedChartData.map(d => formatXAxis(d.date)),
    datasets: data
      .filter(dataset => activeDataSets.includes(dataset.title))
      .map((dataset, index) => {
        const color = colors[index % colors.length];
        return {
          label: dataset.title,
          data: typedChartData.map(d => d[dataset.title] || 0),
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: color,
          tension: 0,
        };
      }),
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
            const datasetTitle = context.dataset.label || '';
            return `${datasetTitle}: ${formatValue(value, datasetTitle)}`;
          },
          title: function(context) {
            const dateStr = typedChartData[context[0].dataIndex]?.date;
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
          text: title.includes('解約率') ? '解約率 (%)' : '数値',
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
        {/* 既存のデータセット選択部分 */}
        {data.length > 1 && (
          <div>
            <span className="mr-2 text-sm">データセット:</span>
            <div className="flex flex-wrap gap-2">
              {data.map((dataSet, index) => (
                <button
                  key={index}
                  onClick={() => handleDataSetToggle(dataSet.title)}
                  className={`rounded px-2 py-1 text-xs ${
                    activeDataSets.includes(dataSet.title)
                      ? 'bg-blue-500 text-white dark:bg-blue-600'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {dataSet.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* チャート */}
      <div className="h-[400px] w-full">
        <Line data={chartJsData} options={chartOptions} />
      </div>
    </div>
  );
}
