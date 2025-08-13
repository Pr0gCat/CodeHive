'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, Target, Users, Code, Terminal } from 'lucide-react';
import EpicDashboard from '@/app/components/hierarchy/EpicDashboard';
import StoryManagement from '@/app/components/hierarchy/StoryManagement';
import TaskTracking from '@/app/components/hierarchy/TaskTracking';
import InstructionExecution from '@/app/components/hierarchy/InstructionExecution';
import { Epic, Story, Task } from '@/lib/models/types';

interface HierarchyPageProps {
  params: {
    id: string;
  };
}

type ViewMode = 'dashboard' | 'epic' | 'story' | 'task';

interface ViewState {
  mode: ViewMode;
  selectedEpic?: Epic;
  selectedStory?: Story;
  selectedTask?: Task;
}

export default function HierarchyPage({ params }: HierarchyPageProps) {
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'dashboard'
  });

  const navigateToEpic = (epic: Epic) => {
    setViewState({
      mode: 'epic',
      selectedEpic: epic
    });
  };

  const navigateToStory = (story: Story) => {
    setViewState({
      mode: 'story',
      selectedStory: story,
      selectedEpic: viewState.selectedEpic
    });
  };

  const navigateToTask = (task: Task) => {
    setViewState({
      mode: 'task',
      selectedTask: task,
      selectedStory: viewState.selectedStory,
      selectedEpic: viewState.selectedEpic
    });
  };

  const goBack = () => {
    switch (viewState.mode) {
      case 'task':
        setViewState({
          mode: 'story',
          selectedStory: viewState.selectedStory,
          selectedEpic: viewState.selectedEpic
        });
        break;
      case 'story':
        setViewState({
          mode: 'epic',
          selectedEpic: viewState.selectedEpic
        });
        break;
      case 'epic':
        setViewState({
          mode: 'dashboard'
        });
        break;
      default:
        // Already at dashboard, could navigate to project page
        window.history.back();
    }
  };

  const renderBreadcrumb = () => {
    const items = [];
    
    items.push({
      label: '專案階層',
      icon: Target,
      active: viewState.mode === 'dashboard'
    });

    if (viewState.selectedEpic) {
      items.push({
        label: viewState.selectedEpic.title,
        icon: Users,
        active: viewState.mode === 'epic'
      });
    }

    if (viewState.selectedStory) {
      items.push({
        label: viewState.selectedStory.title,
        icon: Code,
        active: viewState.mode === 'story'
      });
    }

    if (viewState.selectedTask) {
      items.push({
        label: viewState.selectedTask.title,
        icon: Terminal,
        active: viewState.mode === 'task'
      });
    }

    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div className="flex items-center space-x-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              {index > 0 && <span className="text-gray-400">/</span>}
              <div className={`flex items-center space-x-1 ${item.active ? 'text-blue-600 font-medium' : ''}`}>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (viewState.mode) {
      case 'dashboard':
        return (
          <EpicDashboard
            projectId={params.id}
            onEpicClick={navigateToEpic}
            onCreateEpic={() => {
              // 可以開啟創建史詩的對話框
              console.log('Create epic for project:', params.id);
            }}
          />
        );

      case 'epic':
        if (!viewState.selectedEpic) return null;
        return (
          <StoryManagement
            epicId={viewState.selectedEpic.id}
            onStoryClick={navigateToStory}
            onCreateStory={() => {
              console.log('Create story for epic:', viewState.selectedEpic?.id);
            }}
          />
        );

      case 'story':
        if (!viewState.selectedStory) return null;
        return (
          <TaskTracking
            storyId={viewState.selectedStory.id}
            onTaskClick={navigateToTask}
            onCreateTask={() => {
              console.log('Create task for story:', viewState.selectedStory?.id);
            }}
          />
        );

      case 'task':
        if (!viewState.selectedTask) return null;
        return (
          <InstructionExecution
            taskId={viewState.selectedTask.id}
            onCreateInstruction={() => {
              console.log('Create instruction for task:', viewState.selectedTask?.id);
            }}
            onInstructionExecute={(instruction) => {
              console.log('Instruction executed:', instruction);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      {renderBreadcrumb()}
      
      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">專案 ID: {params.id}</Badge>
                <Badge variant="outline">
                  視圖: {
                    viewState.mode === 'dashboard' ? '總覽' :
                    viewState.mode === 'epic' ? '史詩' :
                    viewState.mode === 'story' ? '故事' : '任務'
                  }
                </Badge>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              AI 驅動的專案開發階層管理
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="space-y-6">
        {renderContent()}
      </div>
    </div>
  );
}