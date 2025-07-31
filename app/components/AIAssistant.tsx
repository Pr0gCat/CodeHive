'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastManager';

interface AIAssistantProps {
  projectId: string;
  context?: {
    type: 'epic' | 'story' | 'dependency';
    data?: any;
  };
}

interface SuggestionResult {
  type: 'epic_breakdown' | 'story_creation' | 'dependency_analysis';
  suggestions: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    estimatedEffort: number;
    dependencies?: string[];
    acceptanceCriteria?: string[];
  }>;
  analysis: {
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFactors: string[];
    recommendations: string[];
  };
}

export default function AIAssistant({ projectId, context }: AIAssistantProps) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionResult | null>(null);
  const [activeFeature, setActiveFeature] = useState<
    'breakdown' | 'dependency' | 'estimation'
  >('breakdown');

  const handleEpicBreakdown = async () => {
    if (!input.trim()) {
      showToast('請輸入 Epic 描述', 'error');
      return;
    }

    setLoading(true);
    try {
      // 模擬 AI 分析過程
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模擬 AI 回應
      const mockResult: SuggestionResult = {
        type: 'epic_breakdown',
        suggestions: [
          {
            id: 'story-1',
            title: '用戶註冊功能',
            description: '允許新用戶使用郵箱和密碼註冊帳號',
            priority: 'HIGH',
            estimatedEffort: 5,
            acceptanceCriteria: [
              '用戶可以輸入有效的郵箱地址',
              '密碼必須符合安全要求',
              '註冊成功後自動登入',
              '發送歡迎郵件',
            ],
          },
          {
            id: 'story-2',
            title: '用戶登入功能',
            description: '已註冊用戶可以使用憑證登入系統',
            priority: 'HIGH',
            estimatedEffort: 3,
            dependencies: ['story-1'],
            acceptanceCriteria: [
              '用戶可以使用郵箱和密碼登入',
              '記住登入狀態選項',
              '錯誤處理和提示',
              '登入後跳轉到儀表板',
            ],
          },
          {
            id: 'story-3',
            title: '用戶資料管理',
            description: '用戶可以查看和編輯個人資料',
            priority: 'MEDIUM',
            estimatedEffort: 4,
            dependencies: ['story-2'],
            acceptanceCriteria: [
              '顯示用戶基本資訊',
              '允許編輯個人資料',
              '頭像上傳功能',
              '密碼修改功能',
            ],
          },
          {
            id: 'story-4',
            title: '忘記密碼功能',
            description: '用戶可以重設忘記的密碼',
            priority: 'MEDIUM',
            estimatedEffort: 3,
            acceptanceCriteria: [
              '通過郵箱重設密碼',
              '安全的重設連結',
              '連結過期機制',
              '成功重設後通知',
            ],
          },
        ],
        analysis: {
          complexity: 'MEDIUM',
          riskFactors: [
            '用戶認證安全性需要仔細設計',
            '郵件發送功能需要第三方服務',
            '密碼安全策略需要明確定義',
          ],
          recommendations: [
            '優先實現核心的註冊登入功能',
            '考慮使用成熟的認證庫',
            '設置適當的錯誤處理和日誌記錄',
            '實施安全最佳實踐（HTTPS、密碼雜湊等）',
          ],
        },
      };

      setSuggestions(mockResult);
      showToast('AI 分析完成！', 'success');
    } catch (error) {
      showToast('AI 分析失敗，請重試', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDependencyAnalysis = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockResult: SuggestionResult = {
        type: 'dependency_analysis',
        suggestions: [
          {
            id: 'dep-1',
            title: '循環依賴檢測',
            description: '發現 Epic A 和 Epic B 之間存在循環依賴',
            priority: 'HIGH',
            estimatedEffort: 0,
          },
          {
            id: 'dep-2',
            title: '關鍵路徑分析',
            description: '用戶認證系統是關鍵路徑上的瓶頸',
            priority: 'HIGH',
            estimatedEffort: 0,
          },
        ],
        analysis: {
          complexity: 'HIGH',
          riskFactors: [
            '存在 3 個循環依賴需要解決',
            '關鍵路徑上有 2 個高風險任務',
            '部分依賴關係缺乏明確定義',
          ],
          recommendations: [
            '立即解決循環依賴問題',
            '重新安排關鍵路徑上的任務優先級',
            '增加依賴關係的文檔說明',
            '考慮將大型 Epic 進一步分解',
          ],
        },
      };

      setSuggestions(mockResult);
      showToast('依賴分析完成！', 'success');
    } catch (error) {
      showToast('依賴分析失敗，請重試', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/create-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          suggestions: suggestions?.suggestions || [],
          type: suggestions?.type || 'epic_breakdown',
        }),
      });

      if (response.ok) {
        showToast('建議已成功創建！', 'success');
        setSuggestions(null);
        setInput('');
        setIsOpen(false);
      } else {
        showToast('創建建議失敗', 'error');
      }
    } catch (error) {
      showToast('創建建議失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-accent-600 hover:bg-accent-700 text-accent-50 p-4 rounded-full shadow-lg transition-all duration-200 z-50"
        title="AI 助手"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 bg-primary-800 border border-primary-600 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-hidden z-50">
      {/* Header */}
      <div className="bg-primary-700 p-4 border-b border-primary-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-accent-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h3 className="text-accent-50 font-medium">AI 智能助手</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-primary-400 hover:text-accent-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Feature Tabs */}
      <div className="flex bg-primary-750 border-b border-primary-600">
        <button
          onClick={() => setActiveFeature('breakdown')}
          className={`flex-1 px-3 py-2 text-sm transition-colors ${
            activeFeature === 'breakdown'
              ? 'text-accent-50 bg-primary-700'
              : 'text-primary-300 hover:text-accent-50'
          }`}
        >
          Epic 分解
        </button>
        <button
          onClick={() => setActiveFeature('dependency')}
          className={`flex-1 px-3 py-2 text-sm transition-colors ${
            activeFeature === 'dependency'
              ? 'text-accent-50 bg-primary-700'
              : 'text-primary-300 hover:text-accent-50'
          }`}
        >
          依賴分析
        </button>
        <button
          onClick={() => setActiveFeature('estimation')}
          className={`flex-1 px-3 py-2 text-sm transition-colors ${
            activeFeature === 'estimation'
              ? 'text-accent-50 bg-primary-700'
              : 'text-primary-300 hover:text-accent-50'
          }`}
        >
          工作量估算
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {activeFeature === 'breakdown' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                描述您想要分解的 Epic：
              </label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 placeholder-primary-400 focus:outline-none focus:border-accent-500"
                placeholder="例如：實現一個完整的用戶管理系統，包括註冊、登入、個人資料管理等功能..."
                rows={4}
              />
            </div>
            <button
              onClick={handleEpicBreakdown}
              disabled={loading || !input.trim()}
              className="w-full px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                  AI 分析中...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  開始分解
                </>
              )}
            </button>
          </div>
        )}

        {activeFeature === 'dependency' && (
          <div className="space-y-4">
            <div className="text-sm text-primary-300">
              分析當前專案中的依賴關係，識別潛在的循環依賴和關鍵路徑。
            </div>
            <button
              onClick={handleDependencyAnalysis}
              disabled={loading}
              className="w-full px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                  分析中...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  開始分析
                </>
              )}
            </button>
          </div>
        )}

        {activeFeature === 'estimation' && (
          <div className="text-center py-8">
            <div className="text-primary-400 mb-2">工作量估算</div>
            <p className="text-sm text-primary-500">
              此功能將根據歷史數據和複雜度分析提供準確的工作量估算
            </p>
          </div>
        )}

        {/* AI Suggestions Display */}
        {suggestions && (
          <div className="mt-6 space-y-4">
            <div className="border-t border-primary-600 pt-4">
              <h4 className="text-accent-50 font-medium mb-3">AI 建議：</h4>

              {/* Analysis Summary */}
              <div className="bg-primary-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-primary-300">複雜度：</span>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      suggestions.analysis.complexity === 'HIGH'
                        ? 'bg-red-900 text-red-300'
                        : suggestions.analysis.complexity === 'MEDIUM'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-green-900 text-green-300'
                    }`}
                  >
                    {suggestions.analysis.complexity}
                  </span>
                </div>
                <div className="text-sm text-primary-400">
                  總計 {suggestions.suggestions.length} 個建議項目
                </div>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2 mb-4">
                {suggestions.suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id}
                    className="bg-primary-700 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="text-accent-50 font-medium text-sm">
                        {suggestion.title}
                      </h5>
                      <span className="text-xs text-primary-400">
                        {suggestion.estimatedEffort}SP
                      </span>
                    </div>
                    <p className="text-sm text-primary-300 mb-2">
                      {suggestion.description}
                    </p>
                    {suggestion.acceptanceCriteria && (
                      <div className="text-xs text-primary-400">
                        驗收標準：{suggestion.acceptanceCriteria.length} 項
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSuggestions}
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-green-600 text-green-50 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  採用建議
                </button>
                <button
                  onClick={() => setSuggestions(null)}
                  className="px-3 py-2 border border-primary-600 text-primary-300 rounded hover:bg-primary-700 text-sm"
                >
                  重新分析
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
