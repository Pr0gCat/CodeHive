'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';

interface TechStackSettings {
  preferredFramework?: string;
  preferredLanguage?: string;
  preferredPackageManager?: string;
  preferredTestFramework?: string;
  preferredLintTool?: string;
  preferredBuildTool?: string;
}

const techStackFields = [
  { key: 'framework', label: 'Framework', placeholder: 'e.g., Next.js, React, Vue.js, Angular, Django, FastAPI' },
  { key: 'language', label: 'Language', placeholder: 'e.g., typescript, javascript, python, java, go, rust' },
  { key: 'packageManager', label: 'Package Manager', placeholder: 'e.g., bun, npm, yarn, pnpm, pip, cargo, maven' },
  { key: 'testFramework', label: 'Test Framework', placeholder: 'e.g., jest, vitest, pytest, junit, cypress, playwright' },
  { key: 'lintTool', label: 'Lint Tool', placeholder: 'e.g., eslint, pylint, flake8, clippy, checkstyle' },
  { key: 'buildTool', label: 'Build Tool', placeholder: 'e.g., webpack, vite, rollup, gradle, maven, cargo' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<TechStackSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof TechStackSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-lg text-primary-300">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-950">
      <Navbar />
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-accent-50">Global Tech Stack Settings</h1>
            <p className="text-primary-300 mt-2">
              Set your preferred tech stack for all projects. These can be overridden per project.
            </p>
          </div>

        {message && (
          <div className={`mb-6 p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-accent-900 border border-accent-700 text-accent-300'
              : 'bg-red-900 border border-red-700 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {techStackFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-primary-300 mb-2">
                  Preferred {field.label}
                </label>
                <input
                  type="text"
                  value={settings[`preferred${field.key.charAt(0).toUpperCase() + field.key.slice(1)}` as keyof TechStackSettings] || ''}
                  onChange={(e) => handleChange(`preferred${field.key.charAt(0).toUpperCase() + field.key.slice(1)}` as keyof TechStackSettings, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-500"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-primary-700">
            <div className="bg-primary-800 border border-primary-700 p-4 rounded-md mb-4">
              <h3 className="font-medium text-primary-300 mb-2">How it works:</h3>
              <ul className="text-sm text-primary-200 space-y-1">
                <li>• Enter any tool names you prefer - agents will use exactly what you specify</li>
                <li>• These settings apply to all new projects as the preferred tech stack</li>
                <li>• You can override these settings for individual projects</li>
                <li>• Leave fields empty to let agents decide based on project context</li>
                <li>• Changes take effect immediately for new agent executions</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-primary-200 bg-primary-800 border border-primary-700 rounded-md hover:bg-primary-700 hover:text-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}