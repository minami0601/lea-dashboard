import { BigQuery } from '@google-cloud/bigquery';

// BigQueryクライアントの初期化
// 注: 実際の環境では適切な認証情報が必要です
export const bigqueryClient = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
});
