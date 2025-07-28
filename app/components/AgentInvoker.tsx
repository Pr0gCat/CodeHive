'use client';

import { useState } from 'react';

interface AgentInvokerProps {
  cardId: string;
  projectId: string;
  onClose: () => void;
}

const AGENT_TYPES = [
  { id: 'project-manager', name: 'Project Manager', description: 'Analyze project and orchestrate other agents' },
  { id: 'code-analyzer', name: 'Code Analyzer', description: 'Analyze code structure and quality' },
  { id: 'file-modifier', name: 'File Modifier', description: 'Modify files based on instructions' },
  { id: 'test-runner', name: 'Test Runner', description: 'Run tests and report results' },
  { id: 'git-operations', name: 'Git Operations', description: 'Perform Git operations' },
  { id: 'documentation', name: 'Documentation', description: 'Generate or update documentation' },
];

const COMMON_COMMANDS = [
  'Analyze the project structure and recommend improvements',
  'Orchestrate multiple agents to improve project health',
  'Read and analyze the current file structure',
  'Fix any TypeScript errors in the project',
  'Run the test suite and report results',
  'Update the README with project changes',
  'Commit the current changes with appropriate message',
  'Generate documentation for the current module',
];

export default function AgentInvoker({ cardId, projectId, onClose }: AgentInvokerProps) {
  const [selectedAgent, setSelectedAgent] = useState(AGENT_TYPES[0].id);
  const [command, setCommand] = useState('');
  const [priority, setPriority] = useState(5);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    setLoading(true);
    try {
      let response;
      
      // Special handling for Project Manager agent
      if (selectedAgent === 'project-manager') {
        const action = command.toLowerCase().includes('orchestrate') ? 'orchestrate' : 'recommend';
        response = await fetch('/api/agents/project-manager', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            cardId,
            action,
          }),
        });
      } else {
        response = await fetch('/api/agents/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            cardId,
            agentType: selectedAgent,
            command: command.trim(),
            priority,
          }),
        });
      }

      const data = await response.json();

      if (data.success) {
        if (selectedAgent === 'project-manager' && data.data.taskIds) {
          setTaskId(`PM:${data.data.taskIds.join(',')}`);
        } else {
          setTaskId(data.data.taskId);
        }
        // Keep the modal open to show task status
      } else {
        alert(`Failed to execute agent: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to execute agent. Please try again.');
      console.error('Agent execution error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommandSelect = (selectedCommand: string) => {
    setCommand(selectedCommand);
  };

  if (taskId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-primary-100 mb-2">Agent Task Queued</h3>
            <p className="text-primary-600 mb-4">
              Your agent task has been queued successfully.
            </p>
            <div className="bg-primary-950 p-3 rounded mb-4">
              <p className="text-sm text-primary-600">Task ID:</p>
              <p className="font-mono text-sm text-primary-100">{taskId}</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-primary-100">Execute Agent</h3>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Agent Type
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border border-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-blue-500"
            >
              {AGENT_TYPES.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} - {agent.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Command
            </label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter the command or instruction for the agent..."
              className="w-full px-3 py-2 border border-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-blue-500"
              rows={4}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Common Commands
            </label>
            <div className="grid grid-cols-1 gap-2">
              {COMMON_COMMANDS.map((commonCommand, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleCommandSelect(commonCommand)}
                  className="text-left px-3 py-2 text-sm bg-primary-950 text-primary-300 rounded hover:bg-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  {commonCommand}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Priority (1-10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-primary-500 mt-1">
              <span>Low (1)</span>
              <span className="font-medium">Current: {priority}</span>
              <span>High (10)</span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-primary-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-primary-300 bg-primary-900 rounded-md hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !command.trim()}
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-accent-50" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Executing...
                </span>
              ) : (
                'Execute Agent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}