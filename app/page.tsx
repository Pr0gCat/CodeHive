import CodeHiveLogo from './components/CodeHiveLogo';
import Navbar from './components/Navbar';
import ProjectProgressDashboard from './components/ProjectProgressDashboard';
import TokenMonitor from './components/TokenMonitor';
import { OverviewDashboard } from './components/oversight/OverviewDashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-primary-950">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <CodeHiveLogo size={64} className="mr-4" />
            <h1 className="text-4xl font-bold text-accent-50">
              歡迎使用 CodeHive
            </h1>
          </div>
          <p className="text-lg text-primary-300">
            Claude Code 驅動的多 Agent 軟體開發平台
          </p>
        </div>

        {/* Portfolio Overview Dashboard */}
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <OverviewDashboard />
          </div>
        </div>

        {/* Secondary Content Grid */}
        <div className="max-w-7xl mx-auto mt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Token Monitor - Left Side */}
            <div>
              <TokenMonitor />
            </div>

            {/* Project Progress Dashboard - Right Side */}
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
