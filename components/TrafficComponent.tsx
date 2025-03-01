'use client';

import React from 'react';

// トラフィックデータの型
type ComparisonPeriod = '前日比' | '前週比' | '前月比';
type ComparisonDirection = 'up' | 'down' | 'same';

interface ComparisonData {
  title: ComparisonPeriod;
  percent: number;
  diff: ComparisonDirection;
}

type TrafficSource = '広告' | 'SEO' | 'SNS' | '直接' | 'その他';
interface TrafficData {
  title: TrafficSource;
  件数: number;
  subData: ComparisonData[];
}

interface TrafficComponentProps {
  trafficData: TrafficData[];
}

export default function TrafficComponent({ trafficData }: TrafficComponentProps) {
  // 合計トラフィック数を計算
  const totalTraffic = trafficData.reduce((sum, item) => sum + item.件数, 0);

  // 各ソースの割合を計算
  const calculatePercentage = (count: number): number => {
    return (count / totalTraffic) * 100;
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

  // トラフィックソースの色を取得
  const getSourceColor = (source: TrafficSource): string => {
    switch (source) {
      case '広告':
        return '#8884d8'; // 紫
      case 'SEO':
        return '#82ca9d'; // 緑
      case 'SNS':
        return '#ffc658'; // 黄色
      case '直接':
        return '#ff8042'; // オレンジ
      case 'その他':
        return '#0088fe'; // 青
      default:
        return '#cccccc';
    }
  };

  return (
    <div className="traffic-container">
      <h3 className="mb-5 text-xl font-bold">流入元内訳</h3>

      {/* トラフィック概要 */}
      <div className="mb-5">
        <div className="text-2xl font-bold">
          合計: {totalTraffic.toLocaleString()} 件
        </div>
      </div>

      {/* トラフィックソース一覧 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trafficData.map((source, index) => (
          <div
            key={index}
            className="rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center text-lg font-bold">
                <div
                  className="mr-2 h-3 w-3 rounded-full"
                  style={{ backgroundColor: getSourceColor(source.title) }}
                ></div>
                {source.title}
              </div>
              <div className="text-sm text-gray-600">
                {calculatePercentage(source.件数).toFixed(1)}%
              </div>
            </div>

            <div className="mb-4 text-2xl font-bold">
              {source.件数.toLocaleString()} 件
            </div>

            {/* 比較データ */}
            <div className="flex flex-wrap gap-2.5">
              {source.subData.map((comparison, cIndex) => (
                <div
                  key={cIndex}
                  className="flex items-center rounded bg-gray-100 px-2.5 py-1.5 text-sm"
                >
                  <span>{comparison.title}: </span>
                  <span className={`ml-1 font-bold ${getDirectionColor(comparison.diff)}`}>
                    {getDirectionIcon(comparison.diff)} {comparison.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
