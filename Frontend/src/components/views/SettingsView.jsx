import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import {
  User,
  ShieldCheck,
  Link2,
  Sliders,
  Keyboard,
  Check,
  RefreshCw,
  ExternalLink,
  Laptop
} from 'lucide-react';

export function SettingsView() {
  const { currentUser, showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [jiraConnected, setJiraConnected] = useState(true);
  const [hrConnected, setHrConnected] = useState(true);

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 pb-4 border-b border-border">
        <h2 className="text-xl font-semibold text-text">Workspace Settings</h2>
        <p className="text-xs text-muted mt-1">
          Identity permissions, enterprise connectors, accessibility, and keyboard shortcuts
        </p>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 mt-4 border-b border-border -mb-4">
          {[
            { id: 'profile', label: 'Profile & Permissions', icon: User },
            { id: 'connections', label: 'Integrations & Connectors', icon: Link2 },
            { id: 'appearance', label: 'Appearance & Motion', icon: Sliders },
            { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        {/* TAB 1: PROFILE & PERMISSIONS */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="p-4 rounded-card bg-surface border border-border flex items-start gap-4">
              {apiClient.isMock ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-full border border-border bg-elevated flex items-center justify-center text-xs font-mono text-primary">
                  {apiClient.apiUserId ? apiClient.apiUserId.slice(0, 5) : '?'}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">
                    {apiClient.isMock ? currentUser.name : apiClient.apiUserId || 'Backend identity not configured'}
                  </h3>
                  {apiClient.isMock && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {currentUser.isContractor ? 'Contractor' : 'Employee'}
                    </span>
                  )}
                </div>
                {apiClient.isMock ? (
                  <>
                    <p className="text-xs text-muted mt-0.5">{currentUser.email}</p>
                    <p className="text-xs text-faint mt-1 font-mono">
                      {currentUser.role} • {currentUser.department}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted mt-0.5">
                    Backend profile details are not exposed. Identity is configured by VITE_API_USER_ID.
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-card bg-surface border border-border">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Access Governance & Group Memberships
              </h4>
              {apiClient.isMock ? (
                <>
                  <p className="text-xs text-muted mb-3">
                    Knowledge indexes and sensitive document policies evaluate your selected simulation persona:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.groups.map((group) => (
                      <div
                        key={group}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated border border-border font-mono text-xs text-purple-300"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{group}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted">
                  Access groups are retrieved and enforced by the backend. This frontend does not expose a user-profile or group-list API.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CONNECTIONS */}
        {activeTab === 'connections' && (
          <div className="space-y-4">
            {/* Jira Connector */}
            <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                  J
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-text">Atlassian Jira Cloud</h4>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        jiraConnected ? 'bg-success/10 text-success' : 'bg-faint/20 text-faint'
                      }`}
                    >
                      {jiraConnected ? 'Connected (Write Guarded)' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Instance: <span className="font-mono text-text">northwind.atlassian.net</span> (PAY, IT, INFRA projects)
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setJiraConnected(!jiraConnected);
                  showToast(jiraConnected ? 'Jira disconnected' : 'Jira connected', 'info');
                }}
                className="px-3 py-1.5 rounded-control bg-elevated hover:bg-hover border border-border text-xs text-text transition-colors"
              >
                {jiraConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            {/* HRIS Portal */}
            <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                  HR
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-text">Northwind HRIS & Workday</h4>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        apiClient.isMock && hrConnected
                          ? 'bg-success/10 text-success'
                          : 'bg-faint/20 text-faint'
                      }`}
                    >
                      {apiClient.isMock ? (hrConnected ? 'Connected' : 'Disconnected') : 'Not in backend'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Leave entitlements, employee directories, and contractor rosters
                  </p>
                </div>
              </div>

              {apiClient.isMock && (
                <button
                  onClick={() => {
                    setHrConnected(!hrConnected);
                    showToast(hrConnected ? 'HRIS disconnected' : 'HRIS connected', 'info');
                  }}
                  className="px-3 py-1.5 rounded-control bg-elevated hover:bg-hover border border-border text-xs text-text transition-colors"
                >
                  {hrConnected ? 'Disconnect' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <div className="p-4 rounded-card bg-surface border border-border space-y-3">
              <h4 className="text-xs font-semibold text-text">Theme & Color Tokens</h4>
              <p className="text-xs text-muted">
                Enterprise Knowledge Assistant is designed exclusively in a calm dark workspace palette:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-2.5 rounded bg-bg border border-border text-center">
                  <span className="block text-[11px] font-mono text-faint">bg #0A0A0F</span>
                  <span className="text-xs font-medium text-text mt-1 block">Canvas</span>
                </div>
                <div className="p-2.5 rounded bg-surface border border-border text-center">
                  <span className="block text-[11px] font-mono text-faint">surface #101017</span>
                  <span className="text-xs font-medium text-text mt-1 block">Surface</span>
                </div>
                <div className="p-2.5 rounded bg-elevated border border-border text-center">
                  <span className="block text-[11px] font-mono text-faint">elevated #16161F</span>
                  <span className="text-xs font-medium text-text mt-1 block">Cards</span>
                </div>
                <div className="p-2.5 rounded bg-primary/20 border border-primary/40 text-center">
                  <span className="block text-[11px] font-mono text-primary">#8B5CF6 / #3B82F6</span>
                  <span className="text-xs font-medium text-primary mt-1 block">Accents</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-card bg-surface border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-text">Reduced Motion</h4>
                  <p className="text-xs text-muted mt-0.5">
                    Automatically conforms to operating system <code>prefers-reduced-motion</code>
                  </p>
                </div>
                <span className="text-[11px] font-mono text-success">Enabled (Auto)</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SHORTCUTS */}
        {activeTab === 'shortcuts' && (
          <div className="p-4 rounded-card bg-surface border border-border space-y-3">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2 font-mono">
              Keyboard Navigation
            </h4>
            <div className="space-y-2 text-xs divide-y divide-border">
              {[
                { label: 'Open Command Palette', keys: ['⌘', 'K'] },
                { label: 'Start New Conversation', keys: ['⌘', '⇧', 'O'] },
                { label: 'Open Dev Simulation Engine', keys: ['⌘', '⇧', 'D'] },
                { label: 'Approve Pending Action Card', keys: ['⌘', '↵'] },
                { label: 'Reject Action or Close Menus', keys: ['Esc'] },
                { label: 'Send Prompt', keys: ['↵'] },
                { label: 'Newline in Composer', keys: ['⇧', '↵'] },
                { label: 'Mention Documents & Repos', keys: ['@'] },
                { label: 'Trigger Slash Actions', keys: ['/'] },
              ].map((s, idx) => (
                <div key={idx} className="flex items-center justify-between py-2">
                  <span className="text-muted">{s.label}</span>
                  <div className="flex items-center gap-1 font-mono">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-0.5 rounded bg-elevated border border-border text-text text-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
