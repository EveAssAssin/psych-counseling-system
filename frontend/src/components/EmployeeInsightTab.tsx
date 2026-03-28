import React, { useState, useEffect } from 'react';
import { insightApi } from '../services/api';

interface EmployeeInsightTabProps {
  employeeAppNumber: string;
  employeeName: string;
}

interface InsightData {
  employee: {
    id: string;
    name: string;
    department: string;
    store_name: string;
    title: string;
  };
  data_sources: {
    conversation_count: number;
    official_message_count: number;
    date_range: { from: string; to: string };
  };
  summary: {
    risk_level: string;
    stress_level: string;
    trend: string;
    overall_assessment: string;
    key_concerns: string[];
    positive_signals: string[];
    last_analyzed: string;
  };
  communication: {
    suggested_timing: string;
    opening_approach: string;
    talking_points: string[];
    avoid_topics: string[];
    sample_phrases: string[];
  };
  transfer_assessment: {
    current_fitness: string;
    transfer_risk: string;
    turnover_risk: string;
    transfer_recommendation: string;
    turnover_signals: string[];
  };
  recommended_actions: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };
  analysis_metadata: {
    analyzed_at: string;
    confidence_score: number;
    data_completeness: number;
  };
}

const riskLevelConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: '低風險', color: 'text-green-700', bgColor: 'bg-green-100' },
  moderate: { label: '中等風險', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  high: { label: '高風險', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  critical: { label: '極高風險', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const stressLevelConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: '低壓力', color: 'text-green-700', bgColor: 'bg-green-100' },
  moderate: { label: '中等壓力', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  high: { label: '高壓力', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  critical: { label: '極高壓力', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const trendConfig: Record<string, { label: string; icon: string }> = {
  improving: { label: '改善中', icon: '📈' },
  stable: { label: '穩定', icon: '➡️' },
  worsening: { label: '惡化中', icon: '📉' },
};

const fitnessConfig: Record<string, string> = {
  high: '高',
  medium: '中等',
  low: '低',
};

export const EmployeeInsightTab: React.FC<EmployeeInsightTabProps> = ({
  employeeAppNumber,
  employeeName,
}) => {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = forceRefresh
        ? await insightApi.refreshInsight(employeeAppNumber)
        : await insightApi.getInsight(employeeAppNumber);
      
      setInsight(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '載入失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsight();
  }, [employeeAppNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">載入中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => fetchInsight()}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          重試
        </button>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">尚無分析資料</p>
        <button
          onClick={() => fetchInsight(true)}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          立即分析
        </button>
      </div>
    );
  }

  const risk = riskLevelConfig[insight.summary.risk_level] || riskLevelConfig.low;
  const stress = stressLevelConfig[insight.summary.stress_level] || stressLevelConfig.low;
  const trend = trendConfig[insight.summary.trend] || trendConfig.stable;

  return (
    <div className="space-y-6">
      {/* 狀態摘要卡片 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">狀態摘要</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              分析時間：{new Date(insight.analysis_metadata.analyzed_at).toLocaleString('zh-TW')}
            </span>
            <button
              onClick={() => fetchInsight(true)}
              disabled={refreshing}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 flex items-center gap-1"
            >
              {refreshing ? (
                <>
                  <span className="animate-spin">⟳</span> 分析中...
                </>
              ) : (
                <>🔄 重新分析</>
              )}
            </button>
          </div>
        </div>

        {/* 狀態標籤 */}
        <div className="flex gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${risk.bgColor} ${risk.color}`}>
            {risk.label}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${stress.bgColor} ${stress.color}`}>
            {stress.label}
          </span>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            {trend.icon} {trend.label}
          </span>
        </div>

        {/* 整體評估 */}
        <p className="text-gray-700">{insight.summary.overall_assessment}</p>

        {/* 資料來源 */}
        <div className="mt-3 text-sm text-gray-500">
          資料來源：{insight.data_sources.conversation_count} 筆對話記錄、
          {insight.data_sources.official_message_count} 筆官方頻道訊息
        </div>
      </div>

      {/* 溝通建議 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 溝通建議</h3>
        
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-600">建議時機：</span>
            <span className="ml-2 text-gray-800">{insight.communication.suggested_timing}</span>
          </div>
          
          <div>
            <span className="text-sm font-medium text-gray-600">開場方式：</span>
            <span className="ml-2 text-gray-800">{insight.communication.opening_approach}</span>
          </div>

          {insight.communication.talking_points?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-600">談話重點：</span>
              <ul className="mt-1 ml-4 list-disc text-gray-800">
                {insight.communication.talking_points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.communication.avoid_topics?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-600">避免話題：</span>
              <ul className="mt-1 ml-4 list-disc text-red-600">
                {insight.communication.avoid_topics.map((topic, i) => (
                  <li key={i}>{topic}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.communication.sample_phrases?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-600">話術範例：</span>
              <div className="mt-2 space-y-2">
                {insight.communication.sample_phrases.map((phrase, i) => (
                  <div key={i} className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-800 italic">
                    「{phrase}」
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 調動評估 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 調動評估</h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">現職適任度</div>
            <div className="text-lg font-semibold text-gray-800">
              {fitnessConfig[insight.transfer_assessment.current_fitness] || '未知'}
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">調動風險</div>
            <div className="text-lg font-semibold text-gray-800">
              {fitnessConfig[insight.transfer_assessment.transfer_risk] || '未知'}
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">離職風險</div>
            <div className="text-lg font-semibold text-gray-800">
              {fitnessConfig[insight.transfer_assessment.turnover_risk] || '未知'}
            </div>
          </div>
        </div>

        <p className="text-gray-700">{insight.transfer_assessment.transfer_recommendation}</p>

        {insight.transfer_assessment.turnover_signals?.length > 0 && (
          <div className="mt-3">
            <span className="text-sm font-medium text-red-600">離職訊號：</span>
            <ul className="mt-1 ml-4 list-disc text-red-600">
              {insight.transfer_assessment.turnover_signals.map((signal, i) => (
                <li key={i}>{signal}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 建議行動 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">✅ 建議行動</h3>
        
        <div className="space-y-4">
          {insight.recommended_actions.immediate?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-red-600">🔴 立即行動：</span>
              <ul className="mt-1 ml-4 list-disc text-gray-800">
                {insight.recommended_actions.immediate.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.recommended_actions.short_term?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-yellow-600">🟡 短期行動：</span>
              <ul className="mt-1 ml-4 list-disc text-gray-800">
                {insight.recommended_actions.short_term.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.recommended_actions.long_term?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-green-600">🟢 長期行動：</span>
              <ul className="mt-1 ml-4 list-disc text-gray-800">
                {insight.recommended_actions.long_term.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 分析元資料 */}
      <div className="text-xs text-gray-400 text-right">
        信心分數：{Math.round((insight.analysis_metadata.confidence_score || 0) * 100)}% | 
        資料完整度：{Math.round((insight.analysis_metadata.data_completeness || 0) * 100)}%
      </div>
    </div>
  );
};

export default EmployeeInsightTab;
