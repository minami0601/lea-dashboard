import { BigQuery, BigQueryOptions } from "@google-cloud/bigquery";
import { format } from "date-fns";

// BigQueryクライアントの初期化
// 常にlea-for-marketplace-prodプロジェクトに接続
const projectId = "lea-for-marketplace-prod";
const keyFilePath = "./key/prod.json";
const useAdc = process.env.BIGQUERY_USE_ADC === "true";

// クライアント初期化オプション
const options: BigQueryOptions = {
  projectId: projectId,
};

// ADCを使用しない場合はキーファイルパスを設定
if (!useAdc && keyFilePath) {
  options.keyFilename = keyFilePath;
}

export const bigqueryClient = new BigQuery(options);

// ファネルデータを取得する関数
export async function fetchFunnelData(
  startDateStr: string = '2024-01-01',
  endDateStr: string | null = null,
) {
  // 終了日が指定されていない場合は、今日の日付を使用
  const endAt = endDateStr || new Date().toISOString().split("T")[0]; // 今日の日付（YYYY-MM-DD形式）
  const startAt = startDateStr; // 明示的に変数に代入

  // テーブルサフィックス用に日付をYYYYMMDD形式に変換
  const startSuffix = startAt.replace(/-/g, '');
  const endSuffix = endAt.replace(/-/g, '');

  const query = `
    WITH day_list AS (
      -- ${startAt} から ${endAt} までの連続日付を生成
      SELECT day AS event_date
      FROM UNNEST(
        GENERATE_DATE_ARRAY(
          DATE('${startAt}'),
          DATE('${endAt}'),
          INTERVAL 1 DAY
        )
      ) AS day
    ),

    -- (1) ユーザーテーブルの集計: 新規登録数 (sub)
    sub AS (
      SELECT
        DATE(subscription_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS new_reg_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE subscription_date >= TIMESTAMP('${startAt} 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (1) ユーザーテーブルの集計: 有料化数 (conv)
    conv AS (
      SELECT
        DATE(conversion_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS paid_conversion_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE conversion_date >= TIMESTAMP('${startAt} 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (1) ユーザーテーブルの集計: 初回注文数 (fst)
    fst AS (
      SELECT
        DATE(first_order_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS first_order_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE first_order_date >= TIMESTAMP('${startAt} 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (2) GA4から該当URLページビューのユニークユーザー数 (二つ目のクエリ相当)
    ga2 AS (
      SELECT
        DATE(TIMESTAMP_MICROS(event_timestamp), 'Asia/Tokyo') AS dt_jst,
        COUNT(DISTINCT user_pseudo_id) AS unique_users_2
      FROM \`lea-for-marketplace-prod.analytics_385732862.events_*\`
      WHERE
        event_name = 'page_view'
        AND _TABLE_SUFFIX BETWEEN '${startSuffix}' AND FORMAT_DATE('%Y%m%d', DATE('${endAt}'))
        AND (
          SELECT ep.value.string_value
          FROM UNNEST(event_params) AS ep
          WHERE ep.key = 'page_location'
        ) LIKE 'https://admin.lea-market.com/auth/register%'
      GROUP BY dt_jst
    ),

    -- (3) GA4 (別プロパティ) 全ページビューのユニークユーザー数 (三つ目のクエリ相当)
    ga3 AS (
      SELECT
        DATE(TIMESTAMP_MICROS(event_timestamp), 'Asia/Tokyo') AS dt_jst,
        COUNT(DISTINCT user_pseudo_id) AS unique_users_3
      FROM \`lea-for-marketplace-prod.analytics_385792904.events_*\`
      WHERE
        event_name = 'page_view'
        AND _TABLE_SUFFIX BETWEEN '${startSuffix}' AND FORMAT_DATE('%Y%m%d', DATE('${endAt}'))
      GROUP BY dt_jst
    )

    SELECT
      -- ファネル順に並べる
      day_list.event_date,
      COALESCE(ga3.unique_users_3, 0)            AS unique_users_3,  -- 3つ目のユニーク数
      COALESCE(ga2.unique_users_2, 0)            AS unique_users_2,  -- 2つ目のユニーク数
      COALESCE(sub.new_reg_count, 0)             AS sub,             -- 新規登録数
      COALESCE(conv.paid_conversion_count, 0)    AS conv,            -- 有料転換数
      COALESCE(fst.first_order_count, 0)         AS fst              -- 初回注文数
    FROM day_list
    LEFT JOIN ga3  ON day_list.event_date = ga3.dt_jst
    LEFT JOIN ga2  ON day_list.event_date = ga2.dt_jst
    LEFT JOIN sub  ON day_list.event_date = sub.dt_jst
    LEFT JOIN conv ON day_list.event_date = conv.dt_jst
    LEFT JOIN fst  ON day_list.event_date = fst.dt_jst
    ORDER BY event_date;
  `;

  try {
    const [rows] = await bigqueryClient.query(query);
    return rows;
  } catch (error) {
    console.error("Error fetching funnel data from BigQuery:", error);
    throw error;
  }
}

// ファネル時系列データを取得する関数
export async function fetchFunnelTimeSeriesData(
  startDateStr: string = '2024-01-01',
  endDateStr: string | null = null,
) {
  // 同じクエリを使用してファネルの時系列データを取得
  try {
    const rows = await fetchFunnelData(startDateStr, endDateStr);

    if (!rows || rows.length === 0) {
      console.error("ファネル時系列データが取得できませんでした");
      return null;
    }

    // 各ステージごとの時系列データを作成
    const hpViews = rows.map((row) => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.unique_users_3),
    }));

    const memberPageViews = rows.map((row) => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.unique_users_2),
    }));

    const registrations = rows.map((row) => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.sub),
    }));

    const paidConversions = rows.map((row) => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.conv),
    }));

    const firstOrders = rows.map((row) => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.fst),
    }));

    return {
      hpViews,
      memberPageViews,
      registrations,
      paidConversions,
      firstOrders,
    };
  } catch (error) {
    console.error("Error fetching funnel time series data:", error);
    return null;
  }
}

// LINE起点のファネルデータを取得する関数
export async function fetchLINEFunnelData(
	startDateStr: string = '2024-01-01',
	endDateStr: string | null = null,
) {
	// 終了日が指定されていない場合は、今日の日付を使用
	const endDate = endDateStr || new Date().toISOString().split("T")[0]; // 今日の日付（YYYY-MM-DD形式）

	const query = `
DECLARE startAt DATE DEFAULT DATE('${startDateStr}');
DECLARE endAt   DATE DEFAULT DATE('${endDate}');

-- Lea Market ファネル分析クエリ（修正版）
-- (LINE登録 → ショップアクセス → カート追加 → 注文 → 2回目 → 3回目)

WITH date_range AS (
  -- 指定期間の日付リストを生成
  SELECT DATE(startAt) + INTERVAL x DAY AS date
  FROM UNNEST(GENERATE_ARRAY(
    0,
    DATE_DIFF(DATE(endAt), DATE(startAt), DAY)
  )) AS x
),

-- (1) LINE有効友達数の日次集計（新規追加数のみ）
user_count_by_date AS (
  SELECT
    DATE(TIMESTAMP(JSON_EXTRACT_SCALAR(data, '$.createdAt'))) AS date,
    COUNT(DISTINCT JSON_EXTRACT_SCALAR(data, '$.userUid')) AS new_users_added
  FROM \`lea-for-marketplace-prod.firestore_export_user.users_raw_changelog\`
  WHERE
    JSON_EXTRACT_SCALAR(data, '$.isBlock') = 'false'
    AND JSON_EXTRACT_SCALAR(data, '$.isBlacklist') = 'false'
    AND TIMESTAMP(JSON_EXTRACT_SCALAR(data, '$.createdAt'))
        BETWEEN TIMESTAMP(startAt)
        AND TIMESTAMP(DATE_ADD(endAt, INTERVAL 1 DAY))
  GROUP BY date
),

-- (2) 日次アクション (ショップアクセス / カート追加 / 注文) の集計
daily_actions AS (
  SELECT
    PARSE_DATE(
      '%Y-%m-%d',
      FORMAT_TIMESTAMP('%Y-%m-%d',
        TIMESTAMP_SECONDS(
          CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64)
        )
      )
    ) AS date,

    -- ショップアクセス
    COUNT(DISTINCT CASE
      WHEN JSON_EXTRACT_SCALAR(data, '$.type') = 'access'
      AND JSON_EXTRACT_SCALAR(data, '$.pageMatchedPath') = '/products/:productUid'
      THEN JSON_EXTRACT_SCALAR(data, '$.userId')
      ELSE NULL
    END) AS productUniqueUsers,

    -- カート追加
    COUNT(DISTINCT CASE
      WHEN JSON_EXTRACT_SCALAR(data, '$.type') = 'cart'
      THEN JSON_EXTRACT_SCALAR(data, '$.userId')
      ELSE NULL
    END) AS cartUniqueUsers,

    -- 注文
    COUNT(DISTINCT CASE
      WHEN JSON_EXTRACT_SCALAR(data, '$.type') = 'order'
      THEN JSON_EXTRACT_SCALAR(data, '$.userId')
      ELSE NULL
    END) AS orderUniqueUsers

  FROM \`lea-for-marketplace-prod.lea_for_marketplace_prod_userActionLog.userActionLog_raw_latest\`
  WHERE
    CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64)
      BETWEEN UNIX_SECONDS(TIMESTAMP(startAt))
      AND UNIX_SECONDS(TIMESTAMP(DATE_ADD(endAt, INTERVAL 1 DAY)))

  GROUP BY date
),

-- (3) ユーザーごとの注文履歴 (注文日時を取得)
user_orders AS (
  SELECT
    JSON_EXTRACT_SCALAR(data, '$.userId') AS userId,
    TIMESTAMP_SECONDS(
      CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64)
    ) AS order_ts
  FROM \`lea-for-marketplace-prod.lea_for_marketplace_prod_userActionLog.userActionLog_raw_latest\`
  WHERE
    JSON_EXTRACT_SCALAR(data, '$.type') = 'order'
    AND CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64)
      BETWEEN UNIX_SECONDS(TIMESTAMP(startAt))
      AND UNIX_SECONDS(TIMESTAMP(DATE_ADD(endAt, INTERVAL 1 DAY)))
),

-- (4) 各ユーザーの注文を時系列で並べ、何回目の注文かを判別
user_orders_seq AS (
  SELECT
    userId,
    order_ts,
    DATE(order_ts) AS order_date,
    ROW_NUMBER() OVER(
      PARTITION BY userId
      ORDER BY order_ts
    ) AS order_num
  FROM user_orders
),

-- (5) 2回目注文 / 3回目注文が起こった日 を集計
daily_repeats AS (
  SELECT
    order_date,
    COUNT(DISTINCT CASE WHEN order_num >= 2 THEN userId END) AS repeat_2_plus,
    COUNT(DISTINCT CASE WHEN order_num >= 3 THEN userId END) AS repeat_3_plus
  FROM user_orders_seq
  GROUP BY order_date
)

-- (6) 日付リストに対して各テーブルを JOIN し、ファネル指標を日次でまとめる
SELECT
  dr.date,
  COALESCE(uc.new_users_added,          0) AS newUsersNum,        -- LINE登録
  COALESCE(da.productUniqueUsers,       0) AS productUniqueUsers,  -- ショップアクセス
  COALESCE(da.cartUniqueUsers,          0) AS cartUniqueUsers,     -- カート追加
  COALESCE(da.orderUniqueUsers,         0) AS orderUniqueUsers,    -- 注文
  COALESCE(drpt.repeat_2_plus,          0) AS repeat2Plus,         -- 2回目注文
  COALESCE(drpt.repeat_3_plus,          0) AS repeat3Plus          -- 3回目注文
FROM
  date_range dr
  LEFT JOIN user_count_by_date uc  ON dr.date = uc.date
  LEFT JOIN daily_actions da       ON dr.date = da.date
  LEFT JOIN daily_repeats drpt     ON dr.date = drpt.order_date
ORDER BY
  dr.date;
`;

	try {
		const [rows] = await bigqueryClient.query(query);
		return rows;
	} catch (error) {
		console.error("Error fetching LINE funnel data from BigQuery:", error);
		throw error;
	}
}

// 検索データを取得する関数
export async function fetchSearchData(
  startDateStr: string = '2024-01-01',
  endDateStr: string | null = null,
) {
  try {
    const endAt = endDateStr || format(new Date(), 'yyyy-MM-dd');
    const startAt = startDateStr;

    // SQLクエリを構築
    const query = `
      -- サイト単位と URL 単位を統合するクエリ
      WITH raw_data AS (
        -- サイト単位テーブル：sum_top_position を sum_position にエイリアス
        SELECT
          data_date,
          clicks,
          impressions,
          sum_top_position AS sum_position
        FROM \`lea-for-marketplace-prod.searchconsole.searchdata_site_impression\`
        WHERE data_date >= DATE('${startAt}')
          AND data_date <= DATE('${endAt}')

        UNION ALL

        -- URL 単位テーブル：sum_position カラム名そのまま
        SELECT
          data_date,
          clicks,
          impressions,
          sum_position
        FROM \`lea-for-marketplace-prod.searchconsole.searchdata_url_impression\`
        WHERE data_date >= DATE('${startAt}')
          AND data_date <= DATE('${endAt}')
      ),

      -- 連続日付を生成し、LEFT JOIN で欠損を埋める
      all_dates AS (
        SELECT day
        FROM UNNEST(
          GENERATE_DATE_ARRAY(
            DATE('${startAt}'),
            DATE('${endAt}')
          )
        ) AS day
      )

      -- 日別にクリック数 / インプレッション数 / CTR / 推定平均掲載順位 を集計
      SELECT
        FORMAT_DATE('%Y-%m-%d', d.day) AS event_date,
        COALESCE(SUM(r.clicks), 0) AS total_clicks,
        COALESCE(SUM(r.impressions), 0) AS total_impressions,
        SAFE_DIVIDE(SUM(r.clicks), SUM(r.impressions)) AS ctr,
        SAFE_DIVIDE(SUM(r.sum_position), SUM(r.impressions)) AS avg_position
      FROM all_dates d
      LEFT JOIN raw_data r
        ON r.data_date = d.day
      GROUP BY
        d.day
      ORDER BY
        d.day;
    `;

    // クエリを実行
    const [rows] = await bigqueryClient.query(query);
    console.log(`検索データクエリ実行: ${rows.length}行取得`);

    return rows;
  } catch (error) {
    console.error("検索データの取得中にエラーが発生しました:", error);
    return null;
  }
}
