'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SocketHookReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  // 房間管理
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  joinEpic: (epicId: string) => void;
  leaveEpic: (epicId: string) => void;
  // 指令執行
  executeInstruction: (instructionId: string) => void;
}

export interface UseSocketOptions {
  // 自動連接選項
  autoConnect?: boolean;
  // 重連選項
  reconnection?: boolean;
  // 事件監聽器
  onProjectStatistics?: (data: any) => void;
  onEpicProgress?: (data: any) => void;
  onEpicUpdated?: (data: any) => void;
  onStoryUpdated?: (data: any) => void;
  onTaskUpdated?: (data: any) => void;
  onInstructionUpdated?: (data: any) => void;
  onInstructionExecuting?: (data: any) => void;
  onInstructionCompleted?: (data: any) => void;
  onInstructionFailed?: (data: any) => void;
  onSystemNotification?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions = {}): SocketHookReturn {
  const {
    autoConnect = true,
    reconnection = true,
    onProjectStatistics,
    onEpicProgress,
    onEpicUpdated,
    onStoryUpdated,
    onTaskUpdated,
    onInstructionUpdated,
    onInstructionExecuting,
    onInstructionCompleted,
    onInstructionFailed,
    onSystemNotification
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 使用 ref 來避免在依賴數組中包含回調函數
  const callbacksRef = useRef({
    onProjectStatistics,
    onEpicProgress,
    onEpicUpdated,
    onStoryUpdated,
    onTaskUpdated,
    onInstructionUpdated,
    onInstructionExecuting,
    onInstructionCompleted,
    onInstructionFailed,
    onSystemNotification
  });

  // 更新回調引用
  useEffect(() => {
    callbacksRef.current = {
      onProjectStatistics,
      onEpicProgress,
      onEpicUpdated,
      onStoryUpdated,
      onTaskUpdated,
      onInstructionUpdated,
      onInstructionExecuting,
      onInstructionCompleted,
      onInstructionFailed,
      onSystemNotification
    };
  }, [
    onProjectStatistics,
    onEpicProgress,
    onEpicUpdated,
    onStoryUpdated,
    onTaskUpdated,
    onInstructionUpdated,
    onInstructionExecuting,
    onInstructionCompleted,
    onInstructionFailed,
    onSystemNotification
  ]);

  useEffect(() => {
    if (!autoConnect) return;

    // 創建 Socket.IO 客戶端
    const socketInstance = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    // 連接事件
    socketInstance.on('connect', () => {
      console.log('✅ Socket 已連接:', socketInstance.id);
      setIsConnected(true);
      setError(null);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Socket 已斷開:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('🚨 Socket 連接錯誤:', err);
      setError(err.message);
      setIsConnected(false);
    });

    // 階層系統事件監聽
    socketInstance.on('project_statistics', (data) => {
      console.log('📊 收到專案統計:', data);
      callbacksRef.current.onProjectStatistics?.(data);
    });

    socketInstance.on('epic_progress', (data) => {
      console.log('📈 收到史詩進度:', data);
      callbacksRef.current.onEpicProgress?.(data);
    });

    socketInstance.on('epic_updated', (data) => {
      console.log('🔄 Epic 已更新:', data);
      callbacksRef.current.onEpicUpdated?.(data);
    });

    socketInstance.on('story_updated', (data) => {
      console.log('🔄 Story 已更新:', data);
      callbacksRef.current.onStoryUpdated?.(data);
    });

    socketInstance.on('task_updated', (data) => {
      console.log('🔄 Task 已更新:', data);
      callbacksRef.current.onTaskUpdated?.(data);
    });

    socketInstance.on('instruction_updated', (data) => {
      console.log('🔄 Instruction 已更新:', data);
      callbacksRef.current.onInstructionUpdated?.(data);
    });

    // 指令執行事件
    socketInstance.on('instruction_executing', (data) => {
      console.log('⚡ 指令執行中:', data);
      callbacksRef.current.onInstructionExecuting?.(data);
    });

    socketInstance.on('instruction_completed', (data) => {
      console.log('✅ 指令執行完成:', data);
      callbacksRef.current.onInstructionCompleted?.(data);
    });

    socketInstance.on('instruction_failed', (data) => {
      console.log('❌ 指令執行失敗:', data);
      callbacksRef.current.onInstructionFailed?.(data);
    });

    // 系統通知
    socketInstance.on('system_notification', (data) => {
      console.log('🔔 系統通知:', data);
      callbacksRef.current.onSystemNotification?.(data);
    });

    setSocket(socketInstance);

    // 清理函數
    return () => {
      console.log('🧹 清理 Socket 連接');
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    };
  }, [autoConnect, reconnection]);

  // 房間管理函數
  const joinProject = (projectId: string) => {
    if (socket && isConnected) {
      console.log('🏠 加入專案房間:', projectId);
      socket.emit('join_project', projectId);
    }
  };

  const leaveProject = (projectId: string) => {
    if (socket && isConnected) {
      console.log('🚪 離開專案房間:', projectId);
      socket.emit('leave_project', projectId);
    }
  };

  const joinEpic = (epicId: string) => {
    if (socket && isConnected) {
      console.log('🏠 加入史詩房間:', epicId);
      socket.emit('join_epic', epicId);
    }
  };

  const leaveEpic = (epicId: string) => {
    if (socket && isConnected) {
      console.log('🚪 離開史詩房間:', epicId);
      socket.emit('leave_epic', epicId);
    }
  };

  // 指令執行
  const executeInstruction = (instructionId: string) => {
    if (socket && isConnected) {
      console.log('▶️ 執行指令:', instructionId);
      socket.emit('execute_instruction', instructionId);
    } else {
      console.warn('⚠️ Socket 未連接，無法執行指令');
    }
  };

  return {
    socket,
    isConnected,
    error,
    joinProject,
    leaveProject,
    joinEpic,
    leaveEpic,
    executeInstruction
  };
}

// 全局 Socket 上下文（可選）
import { createContext, useContext } from 'react';

export const SocketContext = createContext<SocketHookReturn | null>(null);

export function useSocketContext(): SocketHookReturn {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}