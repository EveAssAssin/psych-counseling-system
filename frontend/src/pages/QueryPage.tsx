import { useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { queryApi } from '../services/api';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function QueryPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      setLoading(true);
      const response = await queryApi.ask({ question: userMessage });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.data.answer || '無法取得回答' },
      ]);
    } catch (error) {
      toast.error('查詢失敗');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，查詢時發生錯誤。' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">智能問答</h1>
        <p className="mt-1 text-sm text-gray-500">
          詢問員工狀態、對話記錄等相關問題
        </p>
      </div>

      <div className="flex-1 card flex flex-col">
        {/* 訊息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>開始提問吧！例如：</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>「王小明最近的狀態如何？」</li>
                <li>「有哪些員工需要追蹤？」</li>
                <li>「最近有哪些高風險案例？」</li>
              </ul>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="text-gray-500">思考中...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 輸入框 */}
        <form onSubmit={sendMessage} className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入您的問題..."
              className="flex-1 input"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
