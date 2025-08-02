import Navbar from '../components/Navbar';
import { ProjectMonitoring } from '../components/oversight/ProjectMonitoring';

export default function OversightPage() {

  return (
    <div className="min-h-screen bg-primary-950">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-accent-50 mb-2">專案監控</h1>
          <p className="text-primary-300">即時監控和管理您的開發專案狀態</p>
        </div>

        {/* Project Monitoring Content */}
        <div className="min-h-[600px]">
          <ProjectMonitoring />
        </div>
      </div>
    </div>
  );
}