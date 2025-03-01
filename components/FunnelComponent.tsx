'use client';

import * as React from 'react';

type FunnelStage = 'HP' | '会員ページ' | '新規登録' | '有料転換' | '初注文完了';

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

export default function FunnelComponent({ title, steps, overallConversionRate }: FunnelComponentProps) {
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
              className="min-w-[150px] rounded-lg px-5 py-4 text-center text-white shadow-md"
              style={{ backgroundColor: step.color || defaultColors[index % defaultColors.length] }}
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

      {/* 全体の変換率 */}
      {steps.length >= 2 && (
        <div className="mx-auto mt-8 max-w-[600px] rounded-lg bg-gray-100 p-4 text-center">
          <div className="mb-1 text-base font-bold">
            全体の変換率（{steps[0].title} → {steps[steps.length - 1].title}）
          </div>
          <div className="text-2xl text-gray-800">
            {overallConversionRate !== undefined
              ? overallConversionRate.toFixed(2)
              : ((steps[steps.length - 1].value / steps[0].value) * 100).toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}
