'use client';

import * as React from 'react';
import { useState } from 'react';

interface TimeSeriesData {
  date: string;
  value: number;
}

// 比較データの型
type ComparisonPeriod = '前日比' | '前週比' | '前月比';
type ComparisonDirection = 'up' | 'down' | 'same';

interface ComparisonData {
  title: ComparisonPeriod;
  percent: number;
  diff: ComparisonDirection;
}

type FunnelStep = {
  title: string;
  value: number | TimeSeriesData[];
  filteredValue?: number;
  color?: string;
  comparisonData?: ComparisonData[]; // 各ステップの比較データ
};

type FunnelComponentProps = {
  title?: string;
  steps: FunnelStep[];
  overallConversionRate: number | undefined;
  dateRange?: {
    start: string;
    end: string;
  };
};

// 日付をYYYY-MM-DD形式に変換する関数
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getThreeMonthsAgo = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return formatDateToString(date);
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

export default function FunnelComponent({ title, steps, dateRange }: FunnelComponentProps) {
  // 期間選択のための状態
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: getThreeMonthsAgo(),
    end: formatDateToString(new Date())
  });

  // dateRangeプロパティが提供された場合はそれを使用
  React.useEffect(() => {
    if (dateRange) {
      setSelectedDateRange(dateRange);
    }
  }, [dateRange]);

  // 日付範囲に基づいてTimeSeriesDataをフィルタリングする関数
  const filterDataByDateRange = (data: TimeSeriesData[]): TimeSeriesData[] => {
    if (!data || !Array.isArray(data)) return [];

    return data.filter(item => {
      const itemDate = item.date;
      return itemDate >= selectedDateRange.start && itemDate <= selectedDateRange.end;
    });
  };

  // 各ステップについて、日付範囲でフィルタリングされたデータまたは単一の値を取得
  const getFilteredSteps = (): FunnelStep[] => {
    return steps.map(step => {
      if (Array.isArray(step.value)) {
        const filteredData = filterDataByDateRange(step.value);
        return {
          ...step,
          filteredValue: filteredData.length > 0
            ? filteredData.reduce((sum, item) => sum + item.value, 0)
            : 0, // フィルタリングされたデータの合計値
        };
      }
      return { ...step, filteredValue: step.value };
    });
  };

  const filteredSteps = getFilteredSteps();

  // 前のステップからの変換率を計算
  const getConversionRate = (currentIndex: number): number => {
    // valueの値を取得する関数
    const getValue = (step: any): number => {
      return step.filteredValue || 0;
    };

    const currentValue = getValue(filteredSteps[currentIndex]);
    const previousValue = currentIndex > 0 ? getValue(filteredSteps[currentIndex - 1]) : 0;

    if (currentIndex === 0 || previousValue === 0) {
      return 100;
    }
    return (currentValue / previousValue) * 100;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800 mb-10">
      {/* タイトル表示（存在する場合） */}
      {title && (
        <h3 className="mb-5 text-xl font-bold">{title}</h3>
      )}

      {/* 横向きファネル */}
      <div className="flex items-center gap-2.5 overflow-x-auto py-2.5">
        {filteredSteps.map((step, index) => (
          <React.Fragment key={index}>
            {/* ステップボックス */}
            <div
              className="min-w-[170px] rounded-lg border border-gray-300 px-5 py-4 text-center"
            >
              <div className="mb-1 text-base font-bold">
                {step.title}
              </div>
              <div className="text-2xl font-bold mb-2">
                {typeof step.filteredValue === 'number'
                  ? step.filteredValue.toLocaleString()
                  : '0'}
              </div>

              {/* 比較データ表示 */}
              {step.comparisonData && step.comparisonData.length > 0 && (
                <div className="flex flex-col gap-1 mt-4 text-left pr-2 pl-5">
                  {step.comparisonData.map((item, idx) => (
                    <div key={idx} className="flex justify-start items-center text-xs">
                      <span className="mr-1">{item.title}:</span>
                      <span className={`font-medium ${getDirectionColor(item.diff)}`}>
                        {getDirectionIcon(item.diff)} {item.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 矢印と変換率 */}
            {index < filteredSteps.length - 1 && (
              <div className="flex flex-col items-center">
                <div className="mb-1 text-xl font-bold text-gray-600">
                  {getConversionRate(index + 1).toFixed(1)}%
                </div>
                <div className="flex items-center">
                  <div className="h-0.5 w-20 bg-gray-300"></div>
                  <div className="border-l-[10px] border-t-[6px] border-b-[6px] border-l-gray-300 border-t-transparent border-b-transparent"></div>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
