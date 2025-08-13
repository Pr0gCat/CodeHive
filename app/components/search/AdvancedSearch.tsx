'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  User,
  Tag,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Code,
  GitBranch,
  Settings,
  Save,
  BookmarkPlus,
  History
} from 'lucide-react';

interface SearchFilter {
  id: string;
  type: 'text' | 'select' | 'date' | 'range' | 'multiSelect';
  label: string;
  key: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
}

interface SearchQuery {
  text: string;
  filters: Record<string, any>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface SearchResult {
  id: string;
  type: 'epic' | 'story' | 'task' | 'instruction';
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: Record<string, any>;
  relevance: number;
  highlights: string[];
}

interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  createdAt: string;
  isDefault?: boolean;
}

interface AdvancedSearchProps {
  placeholder?: string;
  onResults?: (results: SearchResult[]) => void;
  onQueryChange?: (query: SearchQuery) => void;
  projectId?: string;
  defaultQuery?: Partial<SearchQuery>;
}

const searchFilters: SearchFilter[] = [
  {
    id: 'type',
    type: 'multiSelect',
    label: '項目類型',
    key: 'type',
    options: [
      { value: 'epic', label: '史詩' },
      { value: 'story', label: '用戶故事' },
      { value: 'task', label: '任務' },
      { value: 'instruction', label: '指令' }
    ]
  },
  {
    id: 'status',
    type: 'multiSelect',
    label: '狀態',
    key: 'status',
    options: [
      { value: 'pending', label: '待處理' },
      { value: 'in_progress', label: '進行中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' },
      { value: 'failed', label: '失敗' }
    ]
  },
  {
    id: 'priority',
    type: 'multiSelect',
    label: '優先級',
    key: 'priority',
    options: [
      { value: 'critical', label: '緊急' },
      { value: 'high', label: '高' },
      { value: 'medium', label: '中' },
      { value: 'low', label: '低' }
    ]
  },
  {
    id: 'assignee',
    type: 'select',
    label: '負責人',
    key: 'assignee',
    options: [
      { value: 'alice', label: 'Alice Chen' },
      { value: 'bob', label: 'Bob Liu' },
      { value: 'carol', label: 'Carol Wang' },
      { value: 'david', label: 'David Zhang' }
    ]
  },
  {
    id: 'dateRange',
    type: 'date',
    label: '建立時間',
    key: 'createdAt'
  },
  {
    id: 'tags',
    type: 'text',
    label: '標籤',
    key: 'tags',
    placeholder: '輸入標籤，以逗號分隔'
  }
];

const sortOptions = [
  { value: 'relevance', label: '相關性' },
  { value: 'createdAt', label: '建立時間' },
  { value: 'updatedAt', label: '更新時間' },
  { value: 'title', label: '標題' },
  { value: 'priority', label: '優先級' },
  { value: 'status', label: '狀態' }
];

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800'
};

const priorityColors = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
};

const typeIcons = {
  epic: <BarChart3 className="h-4 w-4" />,
  story: <FileText className="h-4 w-4" />,
  task: <CheckCircle className="h-4 w-4" />,
  instruction: <Code className="h-4 w-4" />
};

export default function AdvancedSearch({
  placeholder = '搜尋專案中的史詩、故事、任務...',
  onResults,
  onQueryChange,
  projectId,
  defaultQuery
}: AdvancedSearchProps) {
  const [query, setQuery] = useState<SearchQuery>({
    text: '',
    filters: {},
    sortBy: 'relevance',
    sortOrder: 'desc',
    ...defaultQuery
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 載入已保存的搜尋和歷史記錄
  useEffect(() => {
    loadSavedSearches();
    loadSearchHistory();
  }, []);

  // 當查詢改變時執行搜尋
  useEffect(() => {
    if (query.text || Object.keys(query.filters).length > 0) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [query]);

  // 通知父組件查詢變更
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  const loadSavedSearches = () => {
    const saved = localStorage.getItem('advanced-search-saved');
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  };

  const loadSearchHistory = () => {
    const history = localStorage.getItem('advanced-search-history');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  };

  const saveSearchHistory = (searchText: string) => {
    if (!searchText.trim()) return;
    
    const newHistory = [searchText, ...searchHistory.filter(h => h !== searchText)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('advanced-search-history', JSON.stringify(newHistory));
  };

  const performSearch = useCallback(async () => {
    setLoading(true);
    
    try {
      // 模擬搜尋延遲
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 生成模擬搜尋結果
      const mockResults = generateMockResults();
      
      // 根據查詢過濾結果
      const filteredResults = filterResults(mockResults);
      
      // 排序結果
      const sortedResults = sortResults(filteredResults);
      
      setResults(sortedResults);
      onResults?.(sortedResults);
      
      // 保存搜尋歷史
      if (query.text) {
        saveSearchHistory(query.text);
      }
      
    } catch (error) {
      console.error('搜尋失敗:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const generateMockResults = (): SearchResult[] => {
    const mockData: SearchResult[] = [
      {
        id: '1',
        type: 'epic',
        title: '用戶認證系統重構',
        description: '重新設計和實現用戶認證系統，支援多種登入方式',
        status: 'in_progress',
        priority: 'high',
        assignee: 'Alice Chen',
        createdAt: '2024-01-15T08:00:00Z',
        updatedAt: '2024-01-20T16:30:00Z',
        tags: ['authentication', 'security', 'backend'],
        metadata: { progress: 65, estimatedHours: 120 },
        relevance: 0.95,
        highlights: ['用戶認證', '多種登入方式']
      },
      {
        id: '2',
        type: 'story',
        title: '實現第三方登入功能',
        description: '支援 Google、GitHub、微信等第三方平台登入',
        status: 'pending',
        priority: 'medium',
        assignee: 'Bob Liu',
        createdAt: '2024-01-16T09:15:00Z',
        updatedAt: '2024-01-18T11:20:00Z',
        tags: ['oauth', 'integration', 'frontend'],
        metadata: { storyPoints: 8, dependencies: ['epic-1'] },
        relevance: 0.88,
        highlights: ['第三方登入', 'Google', 'GitHub']
      },
      {
        id: '3',
        type: 'task',
        title: '設計登入介面 UI',
        description: '創建響應式登入表單，包含錯誤處理和載入狀態',
        status: 'completed',
        priority: 'medium',
        assignee: 'Carol Wang',
        createdAt: '2024-01-10T14:30:00Z',
        updatedAt: '2024-01-12T17:45:00Z',
        tags: ['ui', 'design', 'frontend'],
        metadata: { timeSpent: 16, reviewScore: 4.8 },
        relevance: 0.75,
        highlights: ['登入介面', '響應式']
      },
      {
        id: '4',
        type: 'instruction',
        title: '配置 OAuth 2.0 設定',
        description: '設定 OAuth 2.0 客戶端憑證和回調 URL',
        status: 'in_progress',
        priority: 'high',
        assignee: 'David Zhang',
        createdAt: '2024-01-18T10:00:00Z',
        updatedAt: '2024-01-19T15:30:00Z',
        tags: ['oauth', 'configuration', 'security'],
        metadata: { complexity: 'high', estimatedTime: 4 },
        relevance: 0.82,
        highlights: ['OAuth 2.0', '配置']
      },
      {
        id: '5',
        type: 'epic',
        title: '效能監控系統',
        description: '建置完整的應用程式效能監控和告警系統',
        status: 'pending',
        priority: 'low',
        assignee: 'Alice Chen',
        createdAt: '2024-01-20T11:00:00Z',
        updatedAt: '2024-01-21T09:15:00Z',
        tags: ['monitoring', 'performance', 'devops'],
        metadata: { progress: 0, estimatedHours: 200 },
        relevance: 0.65,
        highlights: ['效能監控', '告警系統']
      }
    ];

    return mockData;
  };

  const filterResults = (results: SearchResult[]) => {
    return results.filter(result => {
      // 文本搜尋
      if (query.text) {
        const searchText = query.text.toLowerCase();
        const titleMatch = result.title.toLowerCase().includes(searchText);
        const descMatch = result.description?.toLowerCase().includes(searchText);
        const tagMatch = result.tags.some(tag => tag.toLowerCase().includes(searchText));
        
        if (!titleMatch && !descMatch && !tagMatch) {
          return false;
        }
      }

      // 類型過濾
      if (query.filters.type && query.filters.type.length > 0) {
        if (!query.filters.type.includes(result.type)) {
          return false;
        }
      }

      // 狀態過濾
      if (query.filters.status && query.filters.status.length > 0) {
        if (!query.filters.status.includes(result.status)) {
          return false;
        }
      }

      // 優先級過濾
      if (query.filters.priority && query.filters.priority.length > 0) {
        if (!query.filters.priority.includes(result.priority)) {
          return false;
        }
      }

      // 負責人過濾
      if (query.filters.assignee) {
        const assigneeMap = {
          'alice': 'Alice Chen',
          'bob': 'Bob Liu',
          'carol': 'Carol Wang',
          'david': 'David Zhang'
        };
        
        if (result.assignee !== assigneeMap[query.filters.assignee as keyof typeof assigneeMap]) {
          return false;
        }
      }

      // 標籤過濾
      if (query.filters.tags) {
        const filterTags = query.filters.tags.split(',').map((tag: string) => tag.trim().toLowerCase());
        const hasMatchingTag = filterTags.some(filterTag => 
          result.tags.some(tag => tag.toLowerCase().includes(filterTag))
        );
        
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  };

  const sortResults = (results: SearchResult[]) => {
    const sorted = [...results].sort((a, b) => {
      let comparison = 0;

      switch (query.sortBy) {
        case 'relevance':
          comparison = b.relevance - a.relevance;
          break;
        case 'createdAt':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                      (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return query.sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  const updateQuery = (updates: Partial<SearchQuery>) => {
    setQuery(prev => ({ ...prev, ...updates }));
  };

  const updateFilter = (key: string, value: any) => {
    setQuery(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value }
    }));
  };

  const removeFilter = (key: string) => {
    setQuery(prev => {
      const newFilters = { ...prev.filters };
      delete newFilters[key];
      return { ...prev, filters: newFilters };
    });
  };

  const clearAllFilters = () => {
    setQuery(prev => ({ ...prev, filters: {}, text: '' }));
  };

  const saveSearch = () => {
    if (!searchName.trim()) return;

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      query: { ...query },
      createdAt: new Date().toISOString()
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('advanced-search-saved', JSON.stringify(updated));
    
    setSearchName('');
    setShowSaveDialog(false);
  };

  const loadSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
  };

  const deleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('advanced-search-saved', JSON.stringify(updated));
  };

  // 計算活動過濾器數量
  const activeFiltersCount = Object.keys(query.filters).filter(key => {
    const value = query.filters[key];
    return value && (Array.isArray(value) ? value.length > 0 : true);
  }).length;

  return (
    <div className="space-y-4">
      {/* 主搜尋列 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query.text}
                onChange={(e) => updateQuery({ text: e.target.value })}
                placeholder={placeholder}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* 搜尋建議下拉 */}
              {query.text && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-10">
                  <div className="p-2 text-xs text-gray-500 border-b">最近搜尋</div>
                  {searchHistory
                    .filter(h => h.toLowerCase().includes(query.text.toLowerCase()))
                    .slice(0, 5)
                    .map((historyItem, index) => (
                      <button
                        key={index}
                        onClick={() => updateQuery({ text: historyItem })}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        <History className="inline h-3 w-3 mr-2 text-gray-400" />
                        {historyItem}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              過濾器
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(true)}
              disabled={!query.text && activeFiltersCount === 0}
            >
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>

          {/* 活動過濾器標籤 */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(query.filters).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;
                
                const filter = searchFilters.find(f => f.key === key);
                const displayValue = Array.isArray(value) ? value.join(', ') : value;
                
                return (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1">
                    {filter?.label}: {displayValue}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-red-600" 
                      onClick={() => removeFilter(key)}
                    />
                  </Badge>
                );
              })}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-red-600 hover:text-red-700"
              >
                清除全部
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 過濾器面板 */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              進階過濾器
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {searchFilters.map(filter => (
                <div key={filter.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {filter.label}
                  </label>
                  
                  {filter.type === 'select' && (
                    <Select
                      value={query.filters[filter.key] || ''}
                      onValueChange={(value) => updateFilter(filter.key, value || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`選擇${filter.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">全部</SelectItem>
                        {filter.options?.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {filter.type === 'multiSelect' && (
                    <div className="space-y-2">
                      {filter.options?.map(option => (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={(query.filters[filter.key] || []).includes(option.value)}
                            onChange={(e) => {
                              const current = query.filters[filter.key] || [];
                              const updated = e.target.checked
                                ? [...current, option.value]
                                : current.filter((v: string) => v !== option.value);
                              updateFilter(filter.key, updated.length > 0 ? updated : undefined);
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {filter.type === 'text' && (
                    <input
                      type="text"
                      value={query.filters[filter.key] || ''}
                      onChange={(e) => updateFilter(filter.key, e.target.value || undefined)}
                      placeholder={filter.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 排序選項 */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    排序方式
                  </label>
                  <Select
                    value={query.sortBy}
                    onValueChange={(value) => updateQuery({ sortBy: value })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    排序順序
                  </label>
                  <Select
                    value={query.sortOrder}
                    onValueChange={(value: 'asc' | 'desc') => updateQuery({ sortOrder: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">降序</SelectItem>
                      <SelectItem value="asc">升序</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 已保存的搜尋 */}
      {savedSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5" />
              已保存的搜尋
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map(savedSearch => (
                <div key={savedSearch.id} className="flex items-center gap-1 bg-gray-100 rounded-md px-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadSearch(savedSearch)}
                    className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                  >
                    {savedSearch.name}
                  </Button>
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-600" 
                    onClick={() => deleteSavedSearch(savedSearch.id)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜尋結果 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              搜尋結果 {results.length > 0 && `(${results.length} 項)`}
            </CardTitle>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {query.text || activeFiltersCount > 0 ? (
                loading ? '搜尋中...' : '未找到符合條件的結果'
              ) : (
                '輸入關鍵字或設置過濾器開始搜尋'
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {results.map(result => (
                <div key={result.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {typeIcons[result.type]}
                        <h3 className="font-medium">{result.title}</h3>
                        
                        <Badge className={statusColors[result.status as keyof typeof statusColors]}>
                          {result.status}
                        </Badge>
                        
                        <Badge className={priorityColors[result.priority as keyof typeof priorityColors]}>
                          {result.priority}
                        </Badge>
                        
                        {result.relevance && query.sortBy === 'relevance' && (
                          <Badge variant="outline">
                            相關性: {Math.round(result.relevance * 100)}%
                          </Badge>
                        )}
                      </div>
                      
                      {result.description && (
                        <p className="text-gray-600 text-sm mb-2">{result.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {result.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {result.assignee}
                          </span>
                        )}
                        
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(result.updatedAt).toLocaleDateString('zh-TW')}
                        </span>
                        
                        {result.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {result.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 保存搜尋對話框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>保存搜尋</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  搜尋名稱
                </label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="為這個搜尋命名..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSearchName('');
                  }}
                >
                  取消
                </Button>
                <Button onClick={saveSearch} disabled={!searchName.trim()}>
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}