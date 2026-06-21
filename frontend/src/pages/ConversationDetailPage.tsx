import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { conversationsApi, analysisApi } from '../services/api';
import toast from 'react-hot-toast';

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 編輯 modal
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // 刪除確認
  const [deleting, setDeleting] = useState(false);

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
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '載入對話資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalysisError(null);
    try {
      setAnalyzing(true);
      const response = await analysisApi.run(id!, false);
      setAnalysis(response.data);
      toast.success('分析完成！');
    } catch (error: any) {
      // 露出真正錯誤訊息
      const msg = error?.response?.data?.message
        || error?.response?.data?.error
        || error?.message
        || '未知錯誤';
      const status = error?.response?.status;
      const detail = status ? `[${status}] ${msg}` : msg;
      setAnalysisError(detail);
      toast.error(`分析失敗：${detail}`, { duration: 8000 });
      // 重新拉一次對話狀態（後端可能改成 failed）
      try {
        const r = await conversationsApi.getById(id!);
        setConversation(r.data);
      } catch {}
    } finally {
      setAnalyzing(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      conversation_type: conversation.conversation_type || '',
      conversation_date: conversation.conversation_date ? conversation.conversation_date.slice(0, 16) : '',
      interviewer_name: conversation.interviewer_name || '',
      background_note: conversation.background_note || '',
      raw_text: conversation.raw_text || conversation.extracted_text || '',
      priority: conversation.priority || 'normal',
      need_followup: !!conversation.need_followup,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (payload.conversation_date) {
        payload.conversation_date = new Date(payload.conversation_date).toISOString();
      } else {
        payload.conversation_date = null;
      }
      await conversationsApi.update(id!, payload);
      toast.success('已更新');
      setEditing(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`確定刪除這筆對話記錄？\n${conversation.conversation_type || ''} / ${conversation.conversation_date?.slice(0, 10) || ''}\n此操作不可復原。`)) {
      return;
    }
    setDeleting(true);
    try {
      await conversationsApi.delete(id!);
      toast.success('已刪除');
      navigate('/conversations');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '刪除失敗');
      setDeleting(false);
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

  // 允許執行分析的條件：有 raw_text 或 extracted_text 即可
  const hasContent = !!(conversation.raw_text || conversation.extracted_text);
  const canAnalyze = hasContent;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <Link to="/conversations" className="text-gray-400 hover:text-gray-600 mt-1">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {conversation.conversation_type || '對話記錄'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {conversation.conversation_date
                ? new Date(conversation.conversation_date).toLocaleString('zh-TW')
                : ''}
            </p>
            {conversation.employee && (
              <p className="text-sm text-primary-700 mt-1">
                員工：<span className="font-medium">{conversation.employee.name}</span>
                <span className="text-xs text-gray-500 ml-1">
                  ({conversation.employee.employeeappnumber}
                  {conversation.employee.store_name && ` · ${conversation.employee.store_name}`})
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAnalyze && (
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="btn-primary inline-flex items-center"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  分析中...
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5 mr-1" />
                  {analysis ? '重新分析' : '執行 AI 分析'}
                </>
              )}
            </button>
          )}
          <button
            onClick={openEdit}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
          >
            <PencilSquareIcon className="h-4 w-4 mr-1" />
            編輯
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 rounded-md text-sm bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            刪除
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="card p-4 border-l-4 border-red-500 bg-red-50">
          <p className="text-sm font-semibold text-red-800">AI 分析失敗</p>
          <p className="text-xs text-red-700 mt-1 font-mono break-all">{analysisError}</p>
          <p className="text-xs text-red-600 mt-2">
            常見原因：① 後端 ANTHROPIC_API_KEY 未設定／無效  ② 模型字串錯誤  ③ 對話文字過長超過 token 上限  ④ 網路 / Anthropic 服務暫時不可用。
            可進後端 logs 查 stack trace。
          </p>
        </div>
      )}

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
              {canAnalyze && (
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="btn-primary mt-4"
                >
                  {analyzing ? '分析中...' : '執行 AI 分析'}
                </button>
              )}
              {!hasContent && (
                <p className="text-xs text-red-500 mt-3">無對話文字內容，無法分析</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 編輯 Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">編輯對話記錄</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">類型</label>
                  <input
                    type="text"
                    value={editForm.conversation_type}
                    onChange={(e) => setEditForm({ ...editForm, conversation_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">日期時間</label>
                  <input
                    type="datetime-local"
                    value={editForm.conversation_date}
                    onChange={(e) => setEditForm({ ...editForm, conversation_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">訪談者</label>
                  <input
                    type="text"
                    value={editForm.interviewer_name}
                    onChange={(e) => setEditForm({ ...editForm, interviewer_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">優先級</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                  >
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">背景說明</label>
                <textarea
                  value={editForm.background_note}
                  onChange={(e) => setEditForm({ ...editForm, background_note: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">對話原文</label>
                <textarea
                  value={editForm.raw_text}
                  onChange={(e) => setEditForm({ ...editForm, raw_text: e.target.value })}
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={editForm.need_followup}
                  onChange={(e) => setEditForm({ ...editForm, need_followup: e.target.checked })}
                />
                需要後續追蹤
              </label>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
