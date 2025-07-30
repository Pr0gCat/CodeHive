import CodeHiveLogo from './components/CodeHiveLogo';
import Navbar from './components/Navbar';
import ProjectProgressDashboard from './components/ProjectProgressDashboard';
import TokenMonitor from './components/TokenMonitor';
import TokenStatistics from './components/TokenStatistics';

export default function Home() {
  return (
    <main className="h-screen bg-primary-950 overflow-hidden">
      <Navbar />

      <div className="container mx-auto px-4 py-8 h-full overflow-y-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <CodeHiveLogo size={64} className="text-accent-500 mr-4" />
            <h1 className="text-4xl font-bold text-accent-50">
              歡迎使用 CodeHive
            </h1>
          </div>
          <p className="text-lg text-primary-300 mb-8">
            Claude Code 驅動的多 Agent 軟體開發平台
          </p>
          <div className="mt-8">
            <a
              href="/projects"
              className="inline-flex items-center px-6 py-3 bg-accent-600 text-accent-50 font-medium rounded-lg hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              查看專案
              <svg
                className="ml-2 w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Content Grid */}
        <div className="max-w-6xl mx-auto">
          {/* Token Monitor - Full Width */}
          <div className="mb-8">
            <TokenMonitor />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Token Statistics */}
            <div>
              <TokenStatistics />
            </div>

            {/* Project Progress Dashboard */}
            <div>
              <ProjectProgressDashboard />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-primary-800">
          <div className="text-center">
            <p className="text-primary-400 text-sm">
              由 <span className="text-accent-500 font-medium">ProgCat</span>{' '}
              製作，使用{' '}
              <a
                href="https://claude.ai/code"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-500 hover:text-accent-400 font-medium transition-colors"
              >
                Claude Code
              </a>{' '}
              進行開發
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
