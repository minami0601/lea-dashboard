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
      -- 2024-01-01 から 現在日 (JST) までの連続日付を生成
      SELECT day AS event_date
      FROM UNNEST(
        GENERATE_DATE_ARRAY(
          DATE('2024-01-01'),
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
      WHERE subscription_date >= TIMESTAMP('2024-01-01 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (1) ユーザーテーブルの集計: 有料転換数 (conv)
    conv AS (
      SELECT
        DATE(conversion_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS paid_conversion_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE conversion_date >= TIMESTAMP('2024-01-01 00:00:00', 'Asia/Tokyo')
      GROUP BY dt_jst
    ),

    -- (1) ユーザーテーブルの集計: 初回注文数 (fst)
    fst AS (
      SELECT
        DATE(first_order_date, 'Asia/Tokyo') AS dt_jst,
        COUNT(*) AS first_order_count
      FROM \`lea-for-marketplace-prod.lea_admin_user.admin_user_data\`
      WHERE first_order_date >= TIMESTAMP('2024-01-01 00:00:00', 'Asia/Tokyo')
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

// LINE起点のファネルデータを取得する関数
export async function fetchLINEFunnelData(startDateStr?: string, endDateStr?: string) {
  // デフォルトの日付範囲
  const startAt = startDateStr || '2024-01-01';
  const endAt = endDateStr || new Date().toISOString().split('T')[0]; // 今日の日付（YYYY-MM-DD形式）

  const query = `
    -- Lea Market ファネル分析クエリ（軽量化版）
    -- このクエリはファネルデータ (LINE登録 → ショップアクセス → カート追加 → 注文 → 2回目 → 3回目) のみを取得します
    -- adminUserUidごとの区分けはせず、全体の傾向を把握します

    -- 現在の日付と指定の期間を使用
    DECLARE startAt DATE DEFAULT DATE('${startAt}');
    DECLARE endAt DATE DEFAULT DATE('${endAt}');

    WITH date_range AS (
        SELECT DATE(startAt) + INTERVAL x DAY as date
        FROM UNNEST(GENERATE_ARRAY(0, DATE_DIFF(DATE(endAt), DATE(startAt), DAY))) as x
    ),
    -- LINE有効友達数の集計（日次の新規追加数）
    user_count_by_date AS (
        SELECT
            DATE(TIMESTAMP(JSON_EXTRACT_SCALAR(data, '$.createdAt'))) AS date,
            COUNT(DISTINCT JSON_EXTRACT_SCALAR(data, '$.userUid')) AS new_users_added
        FROM
            \`lea-for-marketplace-prod.firestore_export_user.users_raw_changelog\`
        WHERE
            JSON_EXTRACT_SCALAR(data, '$.isBlock') = 'false' AND
            JSON_EXTRACT_SCALAR(data, '$.isBlacklist') = 'false' AND
            TIMESTAMP(JSON_EXTRACT_SCALAR(data, '$.createdAt')) BETWEEN TIMESTAMP(startAt) AND TIMESTAMP(DATE_ADD(endAt, INTERVAL 1 DAY))
        GROUP BY date
    ),
    -- 必要なアクションの日次集計 (ショップアクセス、カート追加、注文のみ)
    daily_actions AS (
        SELECT
            PARSE_DATE('%Y-%m-%d', FORMAT_TIMESTAMP('%Y-%m-%d', TIMESTAMP_SECONDS(CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64)))) AS date,
            -- 各種アクション集計（ユニークユーザー数のみ）
            COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(data, '$.type') = 'access' AND JSON_EXTRACT_SCALAR(data, '$.pageMatchedPath') = '/products/:productUid' THEN JSON_EXTRACT_SCALAR(data, '$.userId') ELSE NULL END) AS productUniqueUsers,
            COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(data, '$.type') = 'cart' THEN JSON_EXTRACT_SCALAR(data, '$.userId') ELSE NULL END) AS cartUniqueUsers,
            COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(data, '$.type') = 'order' THEN JSON_EXTRACT_SCALAR(data, '$.userId') ELSE NULL END) AS orderUniqueUsers
        FROM \`lea-for-marketplace-prod.lea_for_marketplace_prod_userActionLog.userActionLog_raw_latest\`
        WHERE CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64) BETWEEN UNIX_SECONDS(TIMESTAMP(startAt)) AND UNIX_SECONDS(TIMESTAMP(DATE_ADD(endAt, INTERVAL 1 DAY)))
        GROUP BY date
    ),
    -- 期間全体でのユーザーごとの注文回数集計（リピート注文を適切に把握するため）
    user_order_count AS (
        SELECT
            JSON_EXTRACT_SCALAR(data, '$.userId') AS userId,
            COUNT(*) AS order_count
        FROM \`lea-for-marketplace-prod.lea_for_marketplace_prod_userActionLog.userActionLog_raw_latest\`
        WHERE
            JSON_EXTRACT_SCALAR(data, '$.type') = 'order'
            AND CAST(JSON_EXTRACT_SCALAR(data, '$.createdAt._seconds') AS INT64) BETWEEN UNIX_SECONDS(TIMESTAMP(startAt)) AND UNIX_SECONDS(TIMESTAMP(DATE_ADD(endAt, INTERVAL 1 DAY)))
        GROUP BY userId
    ),
    -- 日付ごとのリピート注文ユーザー数
    repeater_counts AS (
        SELECT
            dr.date,
            COUNT(DISTINCT CASE WHEN uoc.order_count >= 2 THEN uoc.userId ELSE NULL END) AS repeat_2_plus,
            COUNT(DISTINCT CASE WHEN uoc.order_count >= 3 THEN uoc.userId ELSE NULL END) AS repeat_3_plus
        FROM date_range dr
        CROSS JOIN user_order_count uoc
        GROUP BY dr.date
    )

    -- 最終的に全データを結合
    SELECT
        dr.date,
        COALESCE(uc.new_users_added, 0) AS newUsersNum, -- LINE登録（新規追加数）
        COALESCE(da.productUniqueUsers, 0) AS productUniqueUsers, -- ショップアクセス
        COALESCE(da.cartUniqueUsers, 0) AS cartUniqueUsers, -- カート追加
        COALESCE(da.orderUniqueUsers, 0) AS orderUniqueUsers, -- 注文
        COALESCE(rc.repeat_2_plus, 0) AS repeat2Plus, -- 2回目
        COALESCE(rc.repeat_3_plus, 0) AS repeat3Plus, -- 3回目
    FROM date_range dr
    LEFT JOIN user_count_by_date uc ON dr.date = uc.date
    LEFT JOIN daily_actions da ON dr.date = da.date
    LEFT JOIN repeater_counts rc ON dr.date = rc.date
    ORDER BY dr.date;
  `;

  try {
    const [rows] = await bigqueryClient.query(query);
    return rows;
  } catch (error) {
    console.error('Error fetching LINE funnel data from BigQuery:', error);
    throw error;
  }
}
