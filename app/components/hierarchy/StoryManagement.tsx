'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { Plus, BookOpen, CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { Story, Task, ModelStatus, Priority } from '@/lib/models/types';

interface StoryWithTasks extends Story {
  tasks?: Task[];
}

interface StoryManagementProps {
  epicId: string;
  onCreateStory?: () => void;
  onStoryClick?: (story: Story) => void;
}

const priorityColors = {
  [Priority.LOW]: 'bg-gray-100 text-gray-800',
  [Priority.MEDIUM]: 'bg-blue-100 text-blue-800', 
  [Priority.HIGH]: 'bg-yellow-100 text-yellow-800',
  [Priority.CRITICAL]: 'bg-red-100 text-red-800'
};

const priorityLabels = {
  [Priority.LOW]: '低',
  [Priority.MEDIUM]: '中',
  [Priority.HIGH]: '高',
  [Priority.CRITICAL]: '重要'
};

const statusColors = {
  [ModelStatus.PENDING]: 'bg-gray-100 text-gray-800',
  [ModelStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [ModelStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [ModelStatus.FAILED]: 'bg-red-100 text-red-800'
};

const statusLabels = {
  [ModelStatus.PENDING]: '待開始',
  [ModelStatus.IN_PROGRESS]: '進行中',
  [ModelStatus.COMPLETED]: '已完成',
  [ModelStatus.FAILED]: '失敗'
};

const StatusIcon = ({ status }: { status: ModelStatus }) => {
  switch (status) {
    case ModelStatus.COMPLETED:
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case ModelStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-blue-600" />;
    case ModelStatus.FAILED:
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <BookOpen className="h-4 w-4 text-gray-600" />;
  }
};

export default function StoryManagement({ epicId, onCreateStory, onStoryClick }: StoryManagementProps) {
  const [stories, setStories] = useState<StoryWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStory, setNewStory] = useState({
    title: '',
    userStory: '',
    description: '',
    acceptanceCriteria: '',
    storyPoints: 5,
    priority: Priority.MEDIUM
  });

  useEffect(() => {
    fetchStories();
  }, [epicId]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hierarchy/stories?epicId=${epicId}&includeRelations=true`);
      const result = await response.json();

      if (result.success) {
        setStories(result.data);
      } else {
        setError(result.error || '載入故事失敗');
      }
    } catch (err) {
      setError('網路錯誤');
      console.error('Error fetching stories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async () => {
    if (!newStory.title.trim()) return;

    try {
      const response = await fetch('/api/hierarchy/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epicId,
          ...newStory
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setStories([...stories, result.data]);
        setNewStory({
          title: '',
          userStory: '',
          description: '',
          acceptanceCriteria: '',
          storyPoints: 5,
          priority: Priority.MEDIUM
        });
        setShowCreateForm(false);
      } else {
        setError(result.error || '創建故事失敗');
      }
    } catch (err) {
      setError('網路錯誤');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">用戶故事</h3>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">用戶故事</h3>
          <p className="text-sm text-gray-600 mt-1">
            管理史詩中的具體用戶故事和功能需求
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateStory && (
            <Button onClick={onCreateStory} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              生成故事
            </Button>
          )}
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)} 
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            手動新增
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => setError(null)} variant="outline" size="sm" className="mt-2">
              關閉
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Story Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>新增用戶故事</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                故事標題 *
              </label>
              <Input
                value={newStory.title}
                onChange={(e) => setNewStory({ ...newStory, title: e.target.value })}
                placeholder="輸入故事標題..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                用戶故事
              </label>
              <Input
                value={newStory.userStory}
                onChange={(e) => setNewStory({ ...newStory, userStory: e.target.value })}
                placeholder="作為...，我想要...，以便..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                描述
              </label>
              <Textarea
                value={newStory.description}
                onChange={(e) => setNewStory({ ...newStory, description: e.target.value })}
                placeholder="詳細描述故事內容..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                接受標準
              </label>
              <Textarea
                value={newStory.acceptanceCriteria}
                onChange={(e) => setNewStory({ ...newStory, acceptanceCriteria: e.target.value })}
                placeholder="- 條件1&#10;- 條件2&#10;- 條件3"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  故事點數
                </label>
                <Input
                  type="number"
                  min="1"
                  max="13"
                  value={newStory.storyPoints}
                  onChange={(e) => setNewStory({ ...newStory, storyPoints: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  優先級
                </label>
                <select
                  value={newStory.priority}
                  onChange={(e) => setNewStory({ ...newStory, priority: parseInt(e.target.value) as Priority })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={Priority.LOW}>低</option>
                  <option value={Priority.MEDIUM}>中</option>
                  <option value={Priority.HIGH}>高</option>
                  <option value={Priority.CRITICAL}>重要</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateStory}>
                創建故事
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stories List */}
      {stories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">還沒有故事</h4>
            <p className="text-gray-600 mb-4">
              創建用戶故事來分解史詩的功能需求
            </p>
            <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              創建第一個故事
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {stories.map((story) => (
            <Card 
              key={story.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onStoryClick?.(story)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <StatusIcon status={story.status} />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {story.title}
                      </CardTitle>
                      {story.userStory && (
                        <p className="text-sm text-blue-600 mt-1">
                          {story.userStory}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Badge className={priorityColors[story.priority]}>
                      {priorityLabels[story.priority]}
                    </Badge>
                    <Badge className={statusColors[story.status]}>
                      {statusLabels[story.status]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {story.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {story.description}
                  </p>
                )}

                {story.acceptanceCriteria && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">接受標準：</p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {story.acceptanceCriteria}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-4">
                    {story.storyPoints && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">{story.storyPoints} 點</span>
                      </div>
                    )}
                    {story.tasks && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">
                          {story.tasks.filter(t => t.status === ModelStatus.COMPLETED).length}/{story.tasks.length} 任務
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {new Date(story.createdAt).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}