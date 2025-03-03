import { BigQuery } from '@google-cloud/bigquery';

// BigQueryクライアントの初期化
// 常にlea-for-marketplace-prodプロジェクトに接続
const projectId = 'lea-for-marketplace-prod';
const keyFilePath = './key/prod.json';
const useAdc = process.env.BIGQUERY_USE_ADC === 'true';

// クライアント初期化オプション
const options: any = {
  projectId: projectId,
};

// ADCを使用しない場合はキーファイルパスを設定
if (!useAdc && keyFilePath) {
  options.keyFilename = keyFilePath;
}

export const bigqueryClient = new BigQuery(options);

// ファネルデータを取得する関数
export async function fetchFunnelData() {
  const query = `
    WITH day_list AS (
      -- 2024-12-01 から 現在日 (JST) までの連続日付を生成
      SELECT day AS event_date
      FROM UNNEST(
        GENERATE_DATE_ARRAY(
          DATE('2024-12-01'),
          CURRENT_DATE('Asia/Tokyo'),
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
      WHERE subscription_date >= TIMESTAMP('2024-12-01 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (1) ユーザーテーブルの集計: 有料転換数 (conv)
    conv AS (
      SELECT
        DATE(conversion_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS paid_conversion_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE conversion_date >= TIMESTAMP('2024-12-01 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (1) ユーザーテーブルの集計: 初回注文数 (fst)
    fst AS (
      SELECT
        DATE(first_order_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS first_order_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE first_order_date >= TIMESTAMP('2024-12-01 00:00:00', 'Asia/Tokyo')
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
        AND _TABLE_SUFFIX BETWEEN '20241201' AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Tokyo'))
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
        AND _TABLE_SUFFIX BETWEEN '20241201' AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Tokyo'))
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
    console.error('Error fetching funnel data from BigQuery:', error);
    throw error;
  }
}

// ファネル時系列データを取得する関数
export async function fetchFunnelTimeSeriesData() {
  // 同じクエリを使用してファネルの時系列データを取得
  try {
    const rows = await fetchFunnelData();

    if (!rows || rows.length === 0) {
      console.error('ファネル時系列データが取得できませんでした');
      return null;
    }

    // 各ステージごとの時系列データを作成
    const hpViews = rows.map(row => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.unique_users_3)
    }));

    const memberPageViews = rows.map(row => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.unique_users_2)
    }));

    const registrations = rows.map(row => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.sub)
    }));

    const paidConversions = rows.map(row => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.conv)
    }));

    const firstOrders = rows.map(row => ({
      date: row.event_date.value || row.event_date,
      value: Number(row.fst)
    }));

    return {
      hpViews,
      memberPageViews,
      registrations,
      paidConversions,
      firstOrders
    };
  } catch (error) {
    console.error('Error fetching funnel time series data:', error);
    return null;
  }
}
