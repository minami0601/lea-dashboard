'use client';

import * as React from 'react';
import { useState } from 'react';

type FunnelStep = {
  title: string;
  value: number;
  color?: string;
};

type FunnelComponentProps = {
  title?: string;
  steps: FunnelStep[];
  overallConversionRate?: number;
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

export default function FunnelComponent({ title, steps, overallConversionRate }: FunnelComponentProps) {
  // 期間選択のための状態
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: getThreeMonthsAgo(),
    end: formatDateToString(new Date()),
  });

  // 日付範囲の変更ハンドラー
  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    if (e.target instanceof HTMLSelectElement) {
      const [start, end] = e.target.value.split('|');
      setDateRange({ start, end });
    } else {
      const { name, value } = e.target;
      setDateRange(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 前のステップからの変換率を計算
  const getConversionRate = (currentIndex: number): number => {
    if (currentIndex === 0 || steps[currentIndex - 1].value === 0) {
      return 100;
    }
    return (steps[currentIndex].value / steps[currentIndex - 1].value) * 100;
  };

  // デフォルトの色
  const defaultColors = [
    '#8884d8', // 紫
    '#82ca9d', // 緑
    '#ffc658', // 黄色
    '#ff8042', // オレンジ
    '#0088fe', // 青
  ];

  return (
    <div className="p-5">
      {/* タイトル表示（存在する場合） */}
      {title && (
        <h3 className="mb-5 text-center text-xl font-bold">{title}</h3>
      )}

      {/* 横向きファネル */}
      <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-2.5">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* ステップボックス */}
            <div
              className="min-w-[150px] rounded-lg border border-gray-300 px-5 py-4 text-center"
            >
              <div className="mb-1 text-base font-bold">
                {step.title}
              </div>
              <div className="text-2xl font-bold">
                {step.value.toLocaleString()}
              </div>
            </div>

            {/* 矢印と変換率 */}
            {index < steps.length - 1 && (
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
