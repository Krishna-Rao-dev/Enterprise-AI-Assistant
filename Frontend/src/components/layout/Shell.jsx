import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SourcesDrawer } from './SourcesDrawer';
import { MessageList } from '../chat/MessageList';
import { HistoryView } from '../views/HistoryView';
import { ScheduledTasksView } from '../views/ScheduledTasksView';
import { SettingsView } from '../views/SettingsView';
import { HighRiskApprovalModal } from '../chat/HighRiskApprovalModal';
import { SimulatorPanel } from '../simulator/SimulatorPanel';
import { CommandPalette } from '../common/CommandPalette';
import { Toast } from '../common/Toast';

export function Shell() {
  const { activeView, showToast } = useAppStore();

  useEffect(() => {
    if (apiClient.isMock) return undefined;

    let cancelled = false;
    useAppStore.setState({ threads: [], activeThreadId: null });
    apiClient.getChatHistory()
      .then((threads) => {
        if (!cancelled) useAppStore.setState({ threads });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load backend conversation history', error);
          showToast(error.message || 'Failed to load conversation history', 'error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text font-sans antialiased">
      {/* 1. Left Sidebar */}
      <Sidebar />

      {/* 2. Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-bg relative">
        <TopBar />

        {/* Dynamic View Container */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeView === 'chat' && <MessageList />}
          {activeView === 'history' && <HistoryView />}
          {activeView === 'tasks' && <ScheduledTasksView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* 3. Right Sources Drawer */}
      <SourcesDrawer />

      {/* 4. High-Risk Action Approval Modal */}
      <HighRiskApprovalModal />

      {/* 5. Dev Simulator Panel (Bottom Left Float) */}
      {apiClient.isMock && <SimulatorPanel />}

      {/* 6. Command Palette (Cmd+K) */}
      <CommandPalette />

      {/* 7. Toast Alerts */}
      <Toast />
    </div>
  );
}
