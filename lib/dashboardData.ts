import { addDays, format } from "date-fns";
import { fetchFunnelTimeSeriesData, fetchLINEFunnelData } from "./bigqueryClient";

// 比較データの型
type ComparisonPeriod = "前日比" | "前週比" | "前月比";
type ComparisonDirection = "up" | "down" | "same";

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
type GraphTitle =
	| "GMV推移"
	| "有料契約数推移"
	| "解約率推移"
	| "新規会員登録推移"
	| "指名検索件数"
	| "ファネル推移"
	| "HPの推移";
interface GraphSection {
	title: GraphTitle;
	cols: "6" | "12";
	data: GraphDataSet[];
	subData: ComparisonData[];
}

// HPへの流入内訳の型
type TrafficSource = "広告" | "SEO" | "SNS" | "直接" | "その他";
interface TrafficData {
	title: TrafficSource;
	件数: number;
	subData: ComparisonData[];
}

// ファネル系の型
type FunnelStage = "HP" | "会員ページ" | "新規登録" | "有料転換" | "初注文完了";
type LINEFunnelStage =
	| "LINE登録"
	| "ショップアクセス"
	| "カート追加"
	| "注文"
	| "2回目注文"
	| "3回目注文";
interface FunnelStageData {
	title: FunnelStage | LINEFunnelStage;
	件数: TimeSeriesData[];
	subData: ComparisonData[];
}

type FunnelSectionTitle = "全体ファネル推移" | "ショップ全体ファネル";
interface FunnelSection {
	title: FunnelSectionTitle;
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
			title: "前日比",
			percent: parseFloat((Math.random() * 10 - 3).toFixed(1)),
			diff: Math.random() > 0.3 ? "up" : Math.random() > 0.5 ? "down" : "same",
		},
		{
			title: "前週比",
			percent: parseFloat((Math.random() * 15 - 5).toFixed(1)),
			diff: Math.random() > 0.3 ? "up" : Math.random() > 0.5 ? "down" : "same",
		},
		{
			title: "前月比",
			percent: parseFloat((Math.random() * 20 - 5).toFixed(1)),
			diff: Math.random() > 0.4 ? "up" : Math.random() > 0.6 ? "down" : "same",
		},
	];
};

// 時系列データを生成する関数
const generateTimeSeriesData = (
	days: number,
	baseValue: number,
	volatility: number,
	trend: number = 0,
	seasonality: boolean = false,
	startDate: Date = new Date("2024-01-01") // デフォルトの開始日を2024年1月1日に設定
): TimeSeriesData[] => {
	const result: TimeSeriesData[] = [];

	for (let i = 0; i < days; i++) {
		// startDateから日数を足していく（過去→現在の順）
		const date = addDays(startDate, i);
		const dayOfWeek = date.getDay();
		const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

		// 基本値 + トレンド + ランダム変動 + 週末効果 + 季節性
		let value = baseValue;

		// トレンド（日ごとの増加/減少）
		value += trend * i;

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
			value *= 1 + seasonalFactor * 0.2;
		}

		// 負の値を防止
		value = Math.max(Math.round(value), 0);

		result.push({
			date: format(date, "yyyy-MM-dd"),
			value: value,
		});
	}

	return result;
};

// GMV推移のデータを生成
const generateGMVData = (): GraphSection => {
	return {
		title: "GMV推移",
		cols: "12",
		data: [
			{
				title: "GMV",
				data: generateTimeSeriesData(90, 1500000, 200000, 5000, true),
			},
		],
		subData: generateComparisonData(),
	};
};

// 有料契約数推移のデータを生成
const generatePaidSubscriptionsData = (): GraphSection => {
	return {
		title: "有料契約数推移",
		cols: "12",
		data: [
			{
				title: "有料契約数",
				data: generateTimeSeriesData(90, 5000, 500, 20, true),
			},
		],
		subData: generateComparisonData(),
	};
};

// 解約率推移のデータを生成
const generateChurnRateData = (): GraphSection => {
	return {
		title: "解約率推移",
		cols: "12",
		data: [
			{
				title: "解約率",
				data: generateTimeSeriesData(90, 8, 2, -0.05, true).map((item) => ({
					...item,
					value: Math.max(1, item.value), // 最低1%以上、整数値で表示
				})),
			},
		],
		subData: generateComparisonData().map((item) => ({
			...item,
			diff: item.diff === "up" ? "down" : item.diff === "down" ? "up" : "same", // 解約率は下がる方が良い
		})),
	};
};

// 新規会員登録推移のデータを生成
const generateNewRegistrationsData = (): GraphSection => {
	return {
		title: "新規会員登録推移",
		cols: "12",
		data: [
			{
				title: "新規会員登録",
				data: generateTimeSeriesData(90, 300, 50, 1, true),
			},
		],
		subData: generateComparisonData(),
	};
};

// 指名検索件数のデータを生成
const generateSearchCountData = (): GraphSection => {
	return {
		title: "指名検索件数",
		cols: "6",
		data: [
			{
				title: "指名検索件数",
				data: generateTimeSeriesData(90, 2000, 300, 10, true),
			},
		],
		subData: generateComparisonData(),
	};
};
// 非同期バージョンのファネル時系列データ生成関数
export const generateFunnelTimeSeriesDataAsync =
	async (): Promise<GraphSection> => {
		try {
			// BigQueryからデータを取得
			const timeSeriesData = await fetchFunnelTimeSeriesData();

			if (!timeSeriesData) {
				throw new Error("ファネル時系列データが取得できませんでした。");
			}

			return {
				title: "ファネル推移",
				cols: "12",
				data: [
					{ title: "HP", data: timeSeriesData.hpViews },
					{ title: "会員ページ", data: timeSeriesData.memberPageViews },
					{ title: "新規登録", data: timeSeriesData.registrations },
					{ title: "有料転換", data: timeSeriesData.paidConversions },
					{ title: "初注文完了", data: timeSeriesData.firstOrders },
				],
				subData: [],
			};
		} catch (error) {
			console.error("Error fetching funnel time series data:", error);
			throw error;
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
			title: "広告",
			件数: Math.round(totalTraffic * adShare),
			subData: generateComparisonData(),
		},
		{
			title: "SEO",
			件数: Math.round(totalTraffic * seoShare),
			subData: generateComparisonData(),
		},
		{
			title: "SNS",
			件数: Math.round(totalTraffic * snsShare),
			subData: generateComparisonData(),
		},
		{
			title: "直接",
			件数: Math.round(totalTraffic * directShare),
			subData: generateComparisonData(),
		},
		{
			title: "その他",
			件数: Math.round(totalTraffic * otherShare),
			subData: generateComparisonData(),
		},
	];
};

// ファネルデータを生成
export const generateFunnelData = async (
	startDateStr: string = '2024-01-01',
	endDateStr: string | null = null
): Promise<FunnelSection> => {
	try {
		// fetchFunnelTimeSeriesDataを使用して時系列データを取得
		const timeSeriesData = await fetchAndProcessFunnelData(startDateStr, endDateStr);

		if (!timeSeriesData) {
			throw new Error("ファネル時系列データが取得できませんでした。");
		}

		// timeSeriesDataを使用してファネルデータを構築
		const {
			hpViews,
			memberPageViews,
			registrations,
			paidConversions,
			firstOrders,
		} = timeSeriesData;

		return {
			title: "全体ファネル推移",
			data: [
				{
					title: "HP",
					件数: hpViews,
					subData: generateComparisonData(),
				},
				{
					title: "会員ページ",
					件数: memberPageViews,
					subData: generateComparisonData(),
				},
				{
					title: "新規登録",
					件数: registrations,
					subData: generateComparisonData(),
				},
				{
					title: "有料転換",
					件数: paidConversions,
					subData: generateComparisonData(),
				},
				{
					title: "初注文完了",
					件数: firstOrders,
					subData: generateComparisonData(),
				},
			],
			prevPercent: 0,
		};
	} catch (error) {
		console.error("Error fetching funnel data:", error);
		throw error;
	}
};

// LINEファネルデータを生成
export const generateLINEFunnelData = async (
	startDateStr: string = '2024-01-01',
	endDateStr: string | null = null
): Promise<FunnelSection> => {
	try {
		// BigQueryからLINE起点のファネルデータを取得
		const rows = await fetchLINEFunnelData(startDateStr, endDateStr);

		if (!rows || rows.length === 0) {
			throw new Error("LINE起点のファネルデータが取得できませんでした。");
		}

		// 時系列データ形式に変換
		const lineRegistrationData = rows.map((row) => ({
			date: row.date.value || row.date,
			value: Number(row.newUsersNum),
		}));

		const shopAccessData = rows.map((row) => ({
			date: row.date.value || row.date,
			value: Number(row.productUniqueUsers),
		}));

		const cartAddData = rows.map((row) => ({
			date: row.date.value || row.date,
			value: Number(row.cartUniqueUsers),
		}));

		const orderData = rows.map((row) => ({
			date: row.date.value || row.date,
			value: Number(row.orderUniqueUsers),
		}));

		const secondOrderData = rows.map((row) => ({
			date: row.date.value || row.date,
			value: Number(row.repeat2Plus),
		}));

		const thirdOrderData = rows.map((row) => ({
			date: row.date.value || row.date,
			value: Number(row.repeat3Plus),
		}));

		return {
			title: "ショップ全体ファネル",
			data: [
				{
					title: "LINE登録",
					件数: lineRegistrationData,
					subData: generateComparisonData(),
				},
				{
					title: "ショップアクセス",
					件数: shopAccessData,
					subData: generateComparisonData(),
				},
				{
					title: "カート追加",
					件数: cartAddData,
					subData: generateComparisonData(),
				},
				{
					title: "注文",
					件数: orderData,
					subData: generateComparisonData(),
				},
				{
					title: "2回目注文",
					件数: secondOrderData,
					subData: generateComparisonData(),
				},
				{
					title: "3回目注文",
					件数: thirdOrderData,
					subData: generateComparisonData(),
				},
			],
			prevPercent: 10.5, // このデータは固定値としますが、必要に応じて計算値に変更可能
		};
	} catch (error) {
		console.error("Error generating LINE funnel data:", error);
		// エラー時はダミーデータを返すか、エラーを投げる
		throw error;
	}
};

// ファネルデータを一度だけ取得する共通関数
export const fetchAndProcessFunnelData = async (
	startDateStr: string = '2024-01-01',
	endDateStr: string | null = null
) => {
	try {
		// BigQueryからデータを一度だけ取得
		const timeSeriesData = await fetchFunnelTimeSeriesData(startDateStr, endDateStr);

		if (!timeSeriesData) {
			console.error("ファネル時系列データが取得できませんでした。");
			return null;
		}

		return timeSeriesData;
	} catch (error) {
		console.error("Error fetching funnel data:", error);
	}
};

// ダッシュボード全体のデータを生成
export const generateDashboardData = async (
	startDateStr: string = '2024-01-01',
	endDateStr: string | null = null
): Promise<Dashboard> => {
	try {
		// 常にBigQueryからデータを取得
		console.log("BigQueryからデータを取得します");

		// ファネル時系列データを取得
		const timeSeriesData = await fetchAndProcessFunnelData(startDateStr, endDateStr);

		if (!timeSeriesData) {
			throw new Error("ファネル時系列データが取得できませんでした。");
		}

		// ファネル推移グラフ用のデータセクション
		const funnelTimeSeriesSection: GraphSection = {
			title: "ファネル推移",
			cols: "12",
			data: [
				{ title: "会員ページ", data: timeSeriesData.memberPageViews },
				{ title: "新規登録", data: timeSeriesData.registrations },
				{ title: "有料転換", data: timeSeriesData.paidConversions },
				{ title: "初注文完了", data: timeSeriesData.firstOrders },
			],
			subData: [],
		};

		// HPの推移グラフ用のデータセクション（復活）
		const hpTimeSeriesSection: GraphSection = {
			title: "HPの推移",
			cols: "12",
			data: [{ title: "HP閲覧数", data: timeSeriesData.hpViews }],
			subData: generateComparisonData(),
		};

		// ファネルのデータを生成
		const funnelData = await generateFunnelData(startDateStr, endDateStr);
		const lineFunnelData = await generateLINEFunnelData(startDateStr, endDateStr);

		// ファネルデータを配列にまとめる
		const allFunnelData = [funnelData, lineFunnelData];

		return {
			グラフ系: [
				hpTimeSeriesSection,
				funnelTimeSeriesSection,
				// generateGMVData(),
				// generatePaidSubscriptionsData(),
				// generateChurnRateData(),
				// generateNewRegistrationsData(),
				// generateSearchCountData(),
			],
			HPへの流入内訳: generateTrafficSourceData(),
			ファネル系: allFunnelData,
		};
	} catch (error) {
		console.error("Error generating dashboard data:", error);
		throw error;
	}
};
