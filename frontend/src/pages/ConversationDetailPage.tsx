import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon } from '@heroicons/react/24/outline';
import { conversationsApi, analysisApi } from '../services/api';
import toast from 'react-hot-toast';

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [convRes, analysisRes] = await Promise.all([
        conversationsApi.getById(id!),
        analysisApi.getByConversation(id!),
      ]);
      setConversation(convRes.data);
      setAnalysis(analysisRes.data?.found !== false ? analysisRes.data : null);
    } catch (error) {
      toast.error('載入對話資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      const response = await analysisApi.run(id!, false);
      setAnalysis(response.data);
      toast.success('分析完成！');
    } catch (error) {
      toast.error('分析失敗');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!conversation) {
    return <div className="text-center py-8">找不到對話資料</div>;
  }

  const getRiskBadge = (level?: string) => {
    const badges: Record<string, string> = {
      low: 'badge-low',
      moderate: 'badge-moderate',
      high: 'badge-high',
      critical: 'badge-critical',
    };
    return badges[level || ''] || 'badge-low';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/conversations" className="text-gray-400 hover:text-gray-600">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {conversation.conversation_type || '對話記錄'}
            </h1>
            <p className="text-sm text-gray-500">
              {conversation.conversation_date 
                ? new Date(conversation.conversation_date).toLocaleString('zh-TW')
                : ''}
            </p>
          </div>
        </div>
        {!analysis && conversation.intake_status === 'extracted' && (
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="btn-primary"
          >
            {analyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                分析中...
              </>
            ) : (
              <>
                <PlayIcon className="h-5 w-5 mr-2" />
                執行 AI 分析
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 對話內容 */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">對話內容</h2>
          
          {conversation.background_note && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">背景說明</h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {conversation.background_note}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">對話文字</h3>
            <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-96 overflow-y-auto whitespace-pre-wrap">
              {conversation.extracted_text || conversation.raw_text || '無內容'}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">訪談者：</span>
              <span className="ml-1">{conversation.interviewer_name || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">狀態：</span>
              <span className="ml-1">{conversation.intake_status}</span>
            </div>
          </div>
        </div>

        {/* 分析結果 */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">AI 分析結果</h2>
          
          {analysis ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <span className="text-sm text-gray-500">風險等級</span>
                  <div className={`mt-1 ${getRiskBadge(analysis.risk_level)}`}>
                    {analysis.risk_level}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">壓力等級</span>
                  <div className={`mt-1 ${getRiskBadge(analysis.stress_level)}`}>
                    {analysis.stress_level}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">需追蹤</span>
                  <div className={`mt-1 ${analysis.followup_needed ? 'badge-high' : 'badge-low'}`}>
                    {analysis.followup_needed ? '是' : '否'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">心理狀態</h3>
                <p className="text-sm">{analysis.current_psychological_state}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">摘要</h3>
                <p className="text-sm">{analysis.summary}</p>
              </div>

              {analysis.key_topics?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">關鍵議題</h3>
                  <ul className="list-disc list-inside text-sm">
                    {analysis.key_topics.map((topic: string, i: number) => (
                      <li key={i}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.suggested_actions?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">建議行動</h3>
                  <ul className="list-disc list-inside text-sm">
                    {analysis.suggested_actions.map((action: string, i: number) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.supervisor_involvement && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">主管介入建議</h3>
                  <p className="text-sm">{analysis.supervisor_involvement}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {conversation.intake_status === 'completed' 
                ? '分析結果不存在' 
                : '尚未進行分析'}
              {conversation.intake_status === 'extracted' && (
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="btn-primary mt-4"
                >
                  執行 AI 分析
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
