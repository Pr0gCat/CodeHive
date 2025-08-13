'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastManager';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface Message {
  id: string;
  role: 'USER' | 'AGENT';
  content: string;
  timestamp: Date;
  phase?: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  conversationId: string;
  contentType?: 'TEXT' | 'MARKDOWN' | 'JSON';
  isError?: boolean;
  tokenUsage?: number;
}

interface Conversation {
  id: string;
  projectId: string;
  phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
  title?: string;
  messageCount: number;
  tokenUsage: number;
  lastMessageAt?: Date;
}

interface ProjectAgentChatProps {
  projectId: string;
  projectPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  onPhaseChange?: (phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') => void;
}

export default function ProjectAgentChat({ 
  projectId, 
  projectPhase, 
  onPhaseChange 
}: ProjectAgentChatProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation and load messages
  useEffect(() => {
    initializeConversation();
  }, [projectId, projectPhase]);

  const initializeConversation = async () => {
    if (isInitialized) return;
    
    try {
      setIsLoading(true);
      
      // Try to find existing active conversation for this phase
      const response = await fetch(`/api/projects/${projectId}/conversations?phase=${projectPhase}&status=ACTIVE&limit=1`);
      const data = await response.json();
      
      let conversation: Conversation;
      
      if (data.success && data.data.length > 0) {
        // Use existing conversation
        conversation = data.data[0];
        setCurrentConversation(conversation);
        
        // Load existing messages
        await loadMessages(conversation.id);
      } else {
        // Create new conversation
        conversation = await createNewConversation();
        
        // Add welcome message
        await sendWelcomeMessage(conversation.id);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing conversation:', error);
      showToast('初始化對話時發生錯誤', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConversation = async (): Promise<Conversation> => {
    const response = await fetch(`/api/projects/${projectId}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: projectPhase,
        title: `${getPhaseDisplayName(projectPhase)} 對話`
      })
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create conversation');
    }
    
    const conversation = data.data;
    setCurrentConversation(conversation);
    return conversation;
  };

  const loadMessages = async (conversationId: string) => {
    const response = await fetch(`/api/projects/${projectId}/conversations/${conversationId}/messages?limit=100`);
    const data = await response.json();
    
    if (data.success) {
      const apiMessages = data.data.map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'USER' | 'AGENT',
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        phase: msg.phase || projectPhase,
        conversationId: msg.conversationId,
        contentType: msg.contentType,
        isError: msg.isError,
        tokenUsage: msg.tokenUsage
      }));
      setMessages(apiMessages);
    }
  };

  const sendWelcomeMessage = async (conversationId: string) => {
    const welcomeContent = getWelcomeMessage(projectPhase);
    
    const response = await fetch(`/api/projects/${projectId}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'AGENT',
        content: welcomeContent,
        contentType: 'MARKDOWN',
        phase: projectPhase
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const newMessage: Message = {
        id: data.data.id,
        role: 'AGENT',
        content: welcomeContent,
        timestamp: new Date(data.data.createdAt),
        phase: projectPhase,
        conversationId: conversationId,
        contentType: 'MARKDOWN'
      };
      setMessages([newMessage]);
    }
  };

  const getPhaseDisplayName = (phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') => {
    switch (phase) {
      case 'REQUIREMENTS': return '需求獲取';
      case 'MVP': return 'MVP 開發';
      case 'CONTINUOUS': return '持續整合';
      default: return '專案';
    }
  };

  const getWelcomeMessage = (phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') => {
    switch (phase) {
      case 'REQUIREMENTS':
        return `👋 您好！我是您的專案代理。目前我們處於**需求獲取階段**。

讓我們一起探索您的專案願景！請告訴我：

🎯 **您想要建立什麼樣的專案？**
- 專案的主要目標是什麼？
- 誰是目標使用者？
- 核心功能需求有哪些？

💡 **技術偏好：**
- 有偏好的程式語言或框架嗎？
- 有任何技術限制需要考慮？

我會透過對話幫助您定義清楚的專案需求，然後建立完整的專案提案。準備好開始了嗎？`;

      case 'MVP':
        return `🚀 歡迎來到 **MVP 開發階段**！

我現在會根據已定義的需求，循序執行各個史詩和故事。我的工作方式：

📋 **執行模式：**
- 史詩 → 故事 → 任務的層級結構
- 使用 ATDD 循環確保每個功能都經過驗證
- 一次處理一個任務，確保品質

⚙️ **您可以：**
- 調整功能優先順序
- 提出新的需求或變更
- 檢視當前開發進度
- 討論技術實作決策

有什麼問題或需要調整的地方嗎？`;

      case 'CONTINUOUS':
        return `🔄 專案已進入 **持續整合階段**！

恭喜！MVP 已經完成。現在我可以協助您進行持續的改進和開發：

🛠️ **我可以幫您：**
- 新增功能和特性
- 修復錯誤和問題
- 進行代碼重構和優化
- 提升性能和使用者體驗

💬 **工作方式：**
- 基於對話的需求收集
- 相同的史詩-故事-任務結構
- 靈活的迭代週期
- 持續的品質保證

請告訴我您希望改進或新增什麼功能？`;

      default:
        return '👋 您好！我是您的專案代理，準備協助您進行專案開發。';
    }
  };

  const handleClearMessages = async () => {
    if (!currentConversation) return;
    
    const confirmClear = window.confirm('確定要清除所有訊息嗎？此操作無法復原。');
    if (!confirmClear) return;
    
    try {
      setIsLoading(true);
      
      // Create new conversation to replace current one
      const response = await fetch(`/api/projects/${projectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: projectPhase,
          title: `${getPhaseDisplayName(projectPhase)} 對話`
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create new conversation');
      }
      
      // Delete current conversation (including all messages)
      await fetch(`/api/projects/${projectId}/conversations/${currentConversation.id}`, {
        method: 'DELETE'
      });
      
      // Set new conversation and clear messages
      const newConversation = data.data;
      setCurrentConversation(newConversation);
      setMessages([]);
      
      // Send welcome message for new conversation
      await sendWelcomeMessage(newConversation.id);
      
      showToast('所有訊息已清除', 'success');
    } catch (error) {
      console.error('Error clearing messages:', error);
      showToast('清除訊息時發生錯誤', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentConversation) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send user message to API
      const userResponse = await fetch(`/api/projects/${projectId}/conversations/${currentConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'USER',
          content: messageContent,
          contentType: 'TEXT',
          phase: projectPhase
        })
      });

      if (!userResponse.ok) {
        throw new Error('Failed to send message');
      }

      const userData = await userResponse.json();
      const userMessage: Message = {
        id: userData.data.id,
        role: 'USER',
        content: messageContent,
        timestamp: new Date(userData.data.createdAt),
        phase: projectPhase,
        conversationId: currentConversation.id,
        contentType: 'TEXT'
      };

      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);

      // Generate AI response using the new intelligent system
      const aiResponse = await fetch(`/api/projects/${projectId}/conversations/${currentConversation.id}/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          phase: projectPhase
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const responseMessage: Message = {
          id: aiData.data.messageId,
          role: 'AGENT',
          content: aiData.data.response.content,
          timestamp: new Date(),
          phase: projectPhase,
          conversationId: currentConversation.id,
          contentType: aiData.data.response.contentType,
          tokenUsage: aiData.data.response.tokenUsage
        };

        setMessages(prev => [...prev, responseMessage]);

        // Handle phase changes if any
        if (aiData.data.phaseChanged && onPhaseChange && aiData.data.newPhase) {
          // Update the parent component's phase
          onPhaseChange(aiData.data.newPhase);
          showToast(`專案階段已更新至 ${getPhaseDisplayName(aiData.data.newPhase)}`, 'success');
        }

        // Show action notifications if any
        if (aiData.data.actionsCreated.length > 0) {
          showToast(`已建立 ${aiData.data.actionsCreated.length} 個操作`, 'info');
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      showToast('發送訊息時發生錯誤', 'error');
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string, contentType?: string, role?: string) => {
    // For MARKDOWN content type, JSON responses, or AI agent responses, render as markdown
    if (contentType === 'MARKDOWN' || contentType === 'JSON' || role === 'AGENT') {
      return (
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
            // Custom styling for markdown elements
            h1: ({children}) => <h1 className="text-lg font-bold text-accent-200 mb-2">{children}</h1>,
            h2: ({children}) => <h2 className="text-md font-semibold text-accent-200 mb-2">{children}</h2>,
            h3: ({children}) => <h3 className="text-sm font-semibold text-accent-200 mb-1">{children}</h3>,
            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            li: ({children}) => <li className="ml-2">{children}</li>,
            strong: ({children}) => <strong className="font-semibold text-accent-200">{children}</strong>,
            em: ({children}) => <em className="italic text-accent-300">{children}</em>,
            code: ({children, className}) => {
              const isInline = !className;
              return isInline ? (
                <code className="bg-primary-800 text-accent-300 px-1 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              ) : (
                <code className={className}>{children}</code>
              );
            },
            pre: ({children}) => (
              <pre className="bg-primary-800 text-primary-100 p-3 rounded-lg overflow-x-auto mb-2 text-sm">
                {children}
              </pre>
            ),
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-accent-500 pl-4 italic text-primary-300 mb-2">
                {children}
              </blockquote>
            ),
            a: ({href, children}) => (
              <a 
                href={href} 
                className="text-accent-400 hover:text-accent-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            table: ({children}) => (
              <div className="overflow-x-auto mb-2">
                <table className="min-w-full border border-primary-600">
                  {children}
                </table>
              </div>
            ),
            th: ({children}) => (
              <th className="border border-primary-600 bg-primary-700 px-3 py-2 text-left font-semibold text-accent-200">
                {children}
              </th>
            ),
            td: ({children}) => (
              <td className="border border-primary-600 px-3 py-2">
                {children}
              </td>
            ),
          }}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    // For plain text, render with line breaks
    return content.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="flex flex-col h-full bg-primary-800 rounded-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-primary-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-accent-50">專案代理</h3>
            <p className="text-sm text-primary-400">
              {projectPhase === 'REQUIREMENTS' && '需求獲取階段'}
              {projectPhase === 'MVP' && 'MVP 開發階段'}
              {projectPhase === 'CONTINUOUS' && '持續整合階段'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearMessages}
            disabled={isLoading || messages.length === 0}
            className="p-2 text-primary-400 hover:text-accent-400 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="清除所有訊息"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-primary-400">線上</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl ${message.role === 'USER' ? 'order-2' : 'order-1'}`}>
              <div
                className={`px-4 py-3 rounded-lg ${
                  message.role === 'USER'
                    ? 'bg-accent-600 text-white ml-4'
                    : 'bg-primary-700 text-primary-100 mr-4 border border-primary-600'
                }`}
              >
                <div className="text-sm leading-relaxed">
                  {formatMessage(message.content, message.contentType, message.role)}
                </div>
              </div>
              <div
                className={`text-xs text-primary-400 mt-1 ${
                  message.role === 'USER' ? 'text-right mr-4' : 'text-left ml-4'
                }`}
              >
                {message.timestamp.toLocaleTimeString('zh-TW', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-3xl">
              <div className="px-4 py-3 rounded-lg bg-primary-700 text-primary-100 mr-4 border border-primary-600">
                <div className="flex items-center gap-1">
                  <span>專案代理正在輸入</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-accent-500 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-accent-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-1 h-1 bg-accent-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-primary-700">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`與專案代理對話... (Enter 發送，Shift+Enter 換行)`}
            className="flex-1 px-4 py-3 bg-primary-700 border border-primary-600 rounded-lg text-accent-50 placeholder-primary-400 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              inputMessage.trim() && !isLoading
                ? 'bg-accent-600 text-white hover:bg-accent-700'
                : 'bg-primary-600 text-primary-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}