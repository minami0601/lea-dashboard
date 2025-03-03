import { addDays, format, subDays } from 'date-fns';
import { fetchFunnelData, fetchFunnelTimeSeriesData } from './bigqueryClient';

// 比較データの型
type ComparisonPeriod = '前日比' | '前週比' | '前月比';
type ComparisonDirection = 'up' | 'down' | 'same';

interface ComparisonData {
  title: ComparisonPeriod;
  percent: number;
  diff: ComparisonDirection;
}

// グラフデータの型
interface TimeSeriesData {
  date: string;
  value: number;
}

interface GraphDataSet {
  title: string;
  data: TimeSeriesData[];
}

// グラフ系の型
type GraphTitle = 'GMV推移' | '有料契約数推移' | '解約率推移' | '新規会員登録推移' | '指名検索件数' | 'ファネル推移' | 'HPの推移';
interface GraphSection {
  title: GraphTitle;
  cols: '6' | '12';
  data: GraphDataSet[];
  subData: ComparisonData[];
}

// HPへの流入内訳の型
type TrafficSource = '広告' | 'SEO' | 'SNS' | '直接' | 'その他';
interface TrafficData {
  title: TrafficSource;
  件数: number;
  subData: ComparisonData[];
}

// ファネル系の型
type FunnelStage = 'HP' | '会員ページ' | '新規登録' | '有料転換' | '初注文完了';
interface FunnelStageData {
  title: FunnelStage;
  件数: number;
  subData: ComparisonData[];
}

interface FunnelSection {
  title: 'ファネル推移';
  data: FunnelStageData[];
  prevPercent?: number;
}

// ダッシュボード全体の型
export interface Dashboard {
  グラフ系: GraphSection[];
  HPへの流入内訳: TrafficData[];
  ファネル系: FunnelSection[];
}

// ランダムな比較データを生成する関数
const generateComparisonData = (): ComparisonData[] => {
  return [
    {
      title: '前日比',
      percent: parseFloat((Math.random() * 10 - 3).toFixed(1)),
      diff: Math.random() > 0.3 ? 'up' : Math.random() > 0.5 ? 'down' : 'same',
    },
    {
      title: '前週比',
      percent: parseFloat((Math.random() * 15 - 5).toFixed(1)),
      diff: Math.random() > 0.3 ? 'up' : Math.random() > 0.5 ? 'down' : 'same',
    },
    {
      title: '前月比',
      percent: parseFloat((Math.random() * 20 - 5).toFixed(1)),
      diff: Math.random() > 0.4 ? 'up' : Math.random() > 0.6 ? 'down' : 'same',
    },
  ];
};

// 時系列データを生成する関数
const generateTimeSeriesData = (
  days: number,
  baseValue: number,
  volatility: number,
  trend: number = 0,
  seasonality: boolean = false
): TimeSeriesData[] => {
  const today = new Date();
  const result: TimeSeriesData[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 基本値 + トレンド + ランダム変動 + 週末効果 + 季節性
    let value = baseValue;

    // トレンド（日ごとの増加/減少）
    value += trend * (days - i);

    // ランダム変動
    value += (Math.random() * 2 - 1) * volatility;

    // 週末効果（週末は値が下がる）
    if (isWeekend) {
      value *= 0.7;
    }

    // 季節性（月ごとの周期）
    if (seasonality) {
      const month = date.getMonth();
      // 正弦波で季節変動を表現（冬と夏にピーク）
      const seasonalFactor = Math.sin((month / 12) * Math.PI * 2);
      value *= (1 + seasonalFactor * 0.2);
    }

    result.push({
      date: format(date, 'yyyy-MM-dd'),
      value: Math.max(Math.round(value), 0), // 負の値にならないように
    });
  }

  return result;
};

// GMV推移のデータを生成
const generateGMVData = (): GraphSection => {
  return {
    title: 'GMV推移',
    cols: '12',
    data: [
      {
        title: 'GMV',
        data: generateTimeSeriesData(90, 1500000, 200000, 5000, true),
      },
    ],
    subData: generateComparisonData(),
  };
};

// 有料契約数推移のデータを生成
const generatePaidSubscriptionsData = (): GraphSection => {
  return {
    title: '有料契約数推移',
    cols: '12',
    data: [
      {
        title: '有料契約数',
        data: generateTimeSeriesData(90, 5000, 500, 20, true),
      },
    ],
    subData: generateComparisonData(),
  };
};

// 解約率推移のデータを生成
const generateChurnRateData = (): GraphSection => {
  return {
    title: '解約率推移',
    cols: '12',
    data: [
      {
        title: '解約率',
        data: generateTimeSeriesData(90, 8, 2, -0.05, true).map(item => ({
          ...item,
          value: Math.max(1, item.value) // 最低1%以上、整数値で表示
        })),
      },
    ],
    subData: generateComparisonData().map(item => ({
      ...item,
      diff: item.diff === 'up' ? 'down' : item.diff === 'down' ? 'up' : 'same', // 解約率は下がる方が良い
    })),
  };
};

// 新規会員登録推移のデータを生成
const generateNewRegistrationsData = (): GraphSection => {
  return {
    title: '新規会員登録推移',
    cols: '12',
    data: [
      {
        title: '新規会員登録',
        data: generateTimeSeriesData(90, 300, 50, 1, true),
      },
    ],
    subData: generateComparisonData(),
  };
};

// 指名検索件数のデータを生成
const generateSearchCountData = (): GraphSection => {
  return {
    title: '指名検索件数',
    cols: '6',
    data: [
      {
        title: '指名検索件数',
        data: generateTimeSeriesData(90, 2000, 300, 10, true),
      },
    ],
    subData: generateComparisonData(),
  };
};

// ファネル推移のデータを生成
const generateFunnelTimeSeriesData = (): GraphSection => {
  // サンプルデータを生成する関数
  const generateSampleFunnelTimeSeriesData = () => {
    // 各ステージのデータを生成
    const hpViews = generateTimeSeriesData(90, 10000, 1000, 50, true);
    const memberPageViews = hpViews.map(item => ({
      date: item.date,
      value: Math.round(item.value * 0.6), // HPの60%
    }));
    const registrations = memberPageViews.map(item => ({
      date: item.date,
      value: Math.round(item.value * 0.3), // 会員ページの30%
    }));
    const paidConversions = registrations.map(item => ({
      date: item.date,
      value: Math.round(item.value * 0.15), // 新規登録の15%
    }));
    const firstOrders = paidConversions.map(item => ({
      date: item.date,
      value: Math.round(item.value * 0.8), // 有料転換の80%
    }));

    return {
      hpViews,
      memberPageViews,
      registrations,
      paidConversions,
      firstOrders
    };
  };

  // BigQueryからデータを取得する非同期関数
  // 注意: この関数は非同期ですが、generateFunnelTimeSeriesDataは同期関数なので
  // 実際のデータ取得は行わず、サンプルデータを返します
  // 実際のデータ取得は別途実装する必要があります
  try {
    // サンプルデータを使用
    console.log('ファネル時系列データにサンプルデータを使用します');
    const sampleData = generateSampleFunnelTimeSeriesData();

    return {
      title: 'ファネル推移',
      cols: '12',
      data: [
        { title: 'HP', data: sampleData.hpViews },
        { title: '会員ページ', data: sampleData.memberPageViews },
        { title: '新規登録', data: sampleData.registrations },
        { title: '有料転換', data: sampleData.paidConversions },
        { title: '初注文完了', data: sampleData.firstOrders },
      ],
      subData: [],
    };
  } catch (error) {
    console.error('Error in generateFunnelTimeSeriesData:', error);

    // エラー時はサンプルデータを使用
    const sampleData = generateSampleFunnelTimeSeriesData();

    return {
      title: 'ファネル推移',
      cols: '6',
      data: [
        { title: 'HP', data: sampleData.hpViews },
        { title: '会員ページ', data: sampleData.memberPageViews },
        { title: '新規登録', data: sampleData.registrations },
        { title: '有料転換', data: sampleData.paidConversions },
        { title: '初注文完了', data: sampleData.firstOrders },
      ],
      subData: [],
    };
  }
};

// 非同期バージョンのファネル時系列データ生成関数
export const generateFunnelTimeSeriesDataAsync = async (): Promise<GraphSection> => {
  try {
    // BigQueryからデータを取得
    const timeSeriesData = await fetchFunnelTimeSeriesData();

    if (!timeSeriesData) {
      console.log('BigQueryからファネル時系列データが取得できませんでした。サンプルデータを使用します。');
      return generateFunnelTimeSeriesData();
    }

    return {
      title: 'ファネル推移',
      cols: '12',
      data: [
        { title: 'HP', data: timeSeriesData.hpViews },
        { title: '会員ページ', data: timeSeriesData.memberPageViews },
        { title: '新規登録', data: timeSeriesData.registrations },
        { title: '有料転換', data: timeSeriesData.paidConversions },
        { title: '初注文完了', data: timeSeriesData.firstOrders },
      ],
      subData: [],
    };
  } catch (error) {
    console.error('Error fetching funnel time series data:', error);
    return generateFunnelTimeSeriesData();
  }
};

// HPへの流入内訳のデータを生成
const generateTrafficSourceData = (): TrafficData[] => {
  const totalTraffic = 50000;

  // 各ソースの割合
  const adShare = 0.35; // 広告
  const seoShare = 0.25; // SEO
  const snsShare = 0.15; // SNS
  const directShare = 0.2; // 直接
  const otherShare = 0.05; // その他

  return [
    {
      title: '広告',
      件数: Math.round(totalTraffic * adShare),
      subData: generateComparisonData(),
    },
    {
      title: 'SEO',
      件数: Math.round(totalTraffic * seoShare),
      subData: generateComparisonData(),
    },
    {
      title: 'SNS',
      件数: Math.round(totalTraffic * snsShare),
      subData: generateComparisonData(),
    },
    {
      title: '直接',
      件数: Math.round(totalTraffic * directShare),
      subData: generateComparisonData(),
    },
    {
      title: 'その他',
      件数: Math.round(totalTraffic * otherShare),
      subData: generateComparisonData(),
    },
  ];
};

// ファネルデータを生成
export const generateFunnelData = async (): Promise<FunnelSection[]> => {
  try {
    // BigQueryからデータを取得
    const rows = await fetchFunnelData();

    if (!rows || rows.length === 0) {
      console.log('BigQueryからデータが取得できませんでした。サンプルデータを使用します。');
      return generateSampleFunnelData();
    }

    // 合計値を計算
    let totalHP = 0;
    let totalMemberPage = 0;
    let totalRegistration = 0;
    let totalPaidConversion = 0;
    let totalFirstOrder = 0;

    // 各日のデータを合計
    rows.forEach((row: any) => {
      totalHP += Number(row.unique_users_3);
      totalMemberPage += Number(row.unique_users_2);
      totalRegistration += Number(row.sub);
      totalPaidConversion += Number(row.conv);
      totalFirstOrder += Number(row.fst);
    });

    // 全体の変換率を計算
    const overallConversionRate = totalHP > 0 ? (totalFirstOrder / totalHP) * 100 : 0;

    return [
      {
        title: 'ファネル推移',
        data: [
          {
            title: 'HP',
            件数: totalHP,
            subData: generateComparisonData(),
          },
          {
            title: '会員ページ',
            件数: totalMemberPage,
            subData: generateComparisonData(),
          },
          {
            title: '新規登録',
            件数: totalRegistration,
            subData: generateComparisonData(),
          },
          {
            title: '有料転換',
            件数: totalPaidConversion,
            subData: generateComparisonData(),
          },
          {
            title: '初注文完了',
            件数: totalFirstOrder,
            subData: generateComparisonData(),
          },
        ],
        prevPercent: overallConversionRate,
      },
    ];
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    // エラーが発生した場合はサンプルデータを返す
    return generateSampleFunnelData();
  }
};

// サンプルのファネルデータを生成する関数
const generateSampleFunnelData = (): FunnelSection[] => {
  const hpCount = 50000;
  const memberPageCount = Math.round(hpCount * 0.6); // HPの60%
  const registrationCount = Math.round(memberPageCount * 0.3); // 会員ページの30%
  const paidConversionCount = Math.round(registrationCount * 0.15); // 新規登録の15%
  const firstOrderCount = Math.round(paidConversionCount * 0.8); // 有料転換の80%

  const overallConversionRate = (firstOrderCount / hpCount) * 100;

  return [
    {
      title: 'ファネル推移',
      data: [
        {
          title: 'HP',
          件数: hpCount,
          subData: generateComparisonData(),
        },
        {
          title: '会員ページ',
          件数: memberPageCount,
          subData: generateComparisonData(),
        },
        {
          title: '新規登録',
          件数: registrationCount,
          subData: generateComparisonData(),
        },
        {
          title: '有料転換',
          件数: paidConversionCount,
          subData: generateComparisonData(),
        },
        {
          title: '初注文完了',
          件数: firstOrderCount,
          subData: generateComparisonData(),
        },
      ],
      prevPercent: overallConversionRate,
    },
  ];
};

// ファネルデータを一度だけ取得する共通関数
export const fetchAndProcessFunnelData = async () => {
  try {
    // BigQueryからデータを一度だけ取得
    const timeSeriesData = await fetchFunnelTimeSeriesData();

    if (!timeSeriesData) {
      console.log('BigQueryからデータが取得できませんでした。サンプルデータを使用します。');

      // generateFunnelTimeSeriesDataの中のgenerateSampleFunnelTimeSeriesDataを使用
      const generateSampleData = () => {
        // 各ステージのデータを生成
        const hpViews = generateTimeSeriesData(90, 10000, 1000, 50, true);
        const memberPageViews = hpViews.map(item => ({
          date: item.date,
          value: Math.round(item.value * 0.6), // HPの60%
        }));
        const registrations = memberPageViews.map(item => ({
          date: item.date,
          value: Math.round(item.value * 0.3), // 会員ページの30%
        }));
        const paidConversions = registrations.map(item => ({
          date: item.date,
          value: Math.round(item.value * 0.15), // 新規登録の15%
        }));
        const firstOrders = paidConversions.map(item => ({
          date: item.date,
          value: Math.round(item.value * 0.8), // 有料転換の80%
        }));

        return {
          hpViews,
          memberPageViews,
          registrations,
          paidConversions,
          firstOrders
        };
      };

      return generateSampleData();
    }

    return timeSeriesData;
  } catch (error) {
    console.error('Error fetching funnel data:', error);

    // エラー時はサンプルデータを生成
    const generateSampleData = () => {
      const hpViews = generateTimeSeriesData(90, 10000, 1000, 50, true);
      const memberPageViews = hpViews.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.6),
      }));
      const registrations = memberPageViews.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.3),
      }));
      const paidConversions = registrations.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.15),
      }));
      const firstOrders = paidConversions.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.8),
      }));

      return {
        hpViews,
        memberPageViews,
        registrations,
        paidConversions,
        firstOrders
      };
    };

    return generateSampleData();
  }
};

// ダッシュボード全体のデータを生成
export const generateDashboardData = async (): Promise<Dashboard> => {
  try {
    // 常にBigQueryからデータを取得
    console.log('BigQueryからデータを取得します');

    // ファネルデータを一度だけ取得
    const funnelTimeSeriesData = await fetchAndProcessFunnelData();

    // ファネル推移グラフ用のデータセクション
    const funnelTimeSeriesSection: GraphSection = {
      title: 'ファネル推移',
      cols: '12',
      data: [
        { title: '会員ページ', data: funnelTimeSeriesData.memberPageViews },
        { title: '新規登録', data: funnelTimeSeriesData.registrations },
        { title: '有料転換', data: funnelTimeSeriesData.paidConversions },
        { title: '初注文完了', data: funnelTimeSeriesData.firstOrders },
      ],
      subData: [],
    };

    // HPの推移グラフ用のデータセクション
    const hpTimeSeriesSection: GraphSection = {
      title: 'HPの推移',
      cols: '12',
      data: [
        { title: 'HP閲覧数', data: funnelTimeSeriesData.hpViews }
      ],
      subData: [],
    };

    // ファネルデータも取得
    const funnelData = await generateFunnelData();

    return {
      グラフ系: [
        hpTimeSeriesSection,
        funnelTimeSeriesSection,
      ],
      HPへの流入内訳: [],
      ファネル系: funnelData,
    };
  } catch (error) {
    console.error('Error generating dashboard data:', error);

    // エラー時はサンプルデータを使用
    console.log('エラーが発生したため、サンプルデータを使用します');

    // エラー時もファネルデータを一度だけ生成
    const sampleFunnelData = (() => {
      const hpViews = generateTimeSeriesData(90, 10000, 1000, 50, true);
      const memberPageViews = hpViews.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.6),
      }));
      const registrations = memberPageViews.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.3),
      }));
      const paidConversions = registrations.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.15),
      }));
      const firstOrders = paidConversions.map(item => ({
        date: item.date,
        value: Math.round(item.value * 0.8),
      }));

      return {
        hpViews,
        memberPageViews,
        registrations,
        paidConversions,
        firstOrders
      };
    })();

    return {
      グラフ系: [
        {
          title: 'ファネル推移',
          cols: '12',
          data: [
            { title: 'HP', data: sampleFunnelData.hpViews },
            { title: '会員ページ', data: sampleFunnelData.memberPageViews },
            { title: '新規登録', data: sampleFunnelData.registrations },
            { title: '有料転換', data: sampleFunnelData.paidConversions },
            { title: '初注文完了', data: sampleFunnelData.firstOrders },
          ],
          subData: [],
        },
        {
          title: 'HPの推移',
          cols: '6',
          data: [
            { title: 'HP閲覧数', data: sampleFunnelData.hpViews }
          ],
          subData: [],
        }
      ],
      HPへの流入内訳: generateTrafficSourceData(),
      ファネル系: generateSampleFunnelData(),
    };
  }
};
