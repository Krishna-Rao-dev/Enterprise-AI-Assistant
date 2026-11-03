import { create } from 'zustand';
import { apiClient } from '../api/client';
import { MOCK_USERS, DEFAULT_USER_ID } from '../mock/users';
import { INITIAL_THREADS } from '../mock/projects';
import { getStoredTickets, resetTickets } from '../mock/ticketsData';

const STORAGE_THREADS_KEY = 'northwind_assistant_threads';
const STORAGE_USER_KEY = 'northwind_assistant_user_id';
const STORAGE_SIDEBAR_KEY = 'northwind_assistant_sidebar_collapsed';
const STORAGE_TASKS_KEY = 'northwind_assistant_scheduled_tasks';
const PROJECTS = apiClient.getProjects();

const INITIAL_SCHEDULED_TASKS = [
  {
    id: 'st-1',
    name: 'Weekly Redis Idempotency Key Sweep',
    schedule: 'Every Sunday at 02:00 UTC',
    nextRun: 'In 3 days (Sun, 02:00 UTC)',
    status: 'active',
    owner: 'Platform Team',
    category: 'Maintenance',
  },
  {
    id: 'st-2',
    name: 'HRIS Balance Sync Reconciliation',
    schedule: 'Daily at 23:30 IST',
    nextRun: 'Today at 23:30 IST',
    status: 'active',
    owner: 'People Operations',
    category: 'Sync',
  },
  {
    id: 'st-3',
    name: 'Payment Broker Latency SLA Healthcheck',
    schedule: 'Every 4 hours',
    nextRun: 'In 1h 45m',
    status: 'paused',
    owner: 'Rohan Mehta',
    category: 'Monitoring',
  },
];

const loadInitialThreads = () => {
  try {
    const raw = localStorage.getItem(STORAGE_THREADS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load threads from storage', e);
  }
  return INITIAL_THREADS;
};

const loadInitialTasks = () => {
  try {
    const raw = localStorage.getItem(STORAGE_TASKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load tasks from storage', e);
  }
  return INITIAL_SCHEDULED_TASKS;
};

const loadInitialUser = () => {
  try {
    const id = localStorage.getItem(STORAGE_USER_KEY);
    if (id) {
      const found = MOCK_USERS.find(u => u.id === id);
      if (found) return found;
    }
  } catch (e) {}
  return MOCK_USERS.find(u => u.id === DEFAULT_USER_ID) || MOCK_USERS[0];
};

export const useAppStore = create((set, get) => ({
  // Core Data
  threads: loadInitialThreads(),
  activeThreadId: null, // null = new conversation empty state
  selectedProject: PROJECTS[0]?.id || null,
  currentUser: loadInitialUser(),
  projects: PROJECTS,
  scheduledTasks: loadInitialTasks(),
  jiraTickets: getStoredTickets(),

  // Navigation & Views
  activeView: 'chat', // 'chat' | 'history' | 'tasks' | 'settings'
  sidebarCollapsed: localStorage.getItem(STORAGE_SIDEBAR_KEY) === 'true',
  sourcesDrawerOpen: false,
  sourcesDrawerTab: 'sources', // 'sources' | 'activity' | 'jira'
  selectedCitation: null,
  highRiskModalApproval: null, // interrupt data for high risk action modal

  // Dev & Simulator Controls
  simulatorOpen: false,
  speedMultiplier: 1, // 0.5 to 4
  forceNextError: false,
  eventLog: [],

  // Global UI
  toast: null, // { message, type: 'success' | 'info' | 'error' }
  commandPaletteOpen: false,

  // Stream state
  isStreaming: false,
  streamingSteps: [],
  streamingTokens: '',
  streamingCitations: [],

  // Actions
  setActiveThread: (threadId) => {
    set((state) => {
      // Clear unread dot on this thread if present
      const updatedThreads = state.threads.map(t => 
        t.id === threadId ? { ...t, hasUnread: false } : t
      );
      return {
        activeThreadId: threadId,
        activeView: 'chat',
        threads: updatedThreads,
        streamingSteps: [],
        streamingTokens: '',
        streamingCitations: [],
      };
    });
  },

  createNewThread: (projectId) => {
    const project = projectId || get().selectedProject;
    set({
      activeThreadId: null,
      selectedProject: project,
      activeView: 'chat',
      streamingSteps: [],
      streamingTokens: '',
      streamingCitations: [],
    });
  },

  setActiveView: (view) => set({ activeView: view }),

  setSelectedProject: (projectId) => set({ selectedProject: projectId }),

  toggleSidebar: () => {
    set((state) => {
      const next = !state.sidebarCollapsed;
      try {
        localStorage.setItem(STORAGE_SIDEBAR_KEY, String(next));
      } catch (e) {}
      return { sidebarCollapsed: next };
    });
  },

  setSourcesDrawerOpen: (isOpen, tab = 'sources') => {
    set({ sourcesDrawerOpen: isOpen, sourcesDrawerTab: tab });
  },

  toggleSourcesDrawer: (tab) => {
    set((state) => {
      const nextTab = tab || state.sourcesDrawerTab;
      if (state.sourcesDrawerOpen && state.sourcesDrawerTab === nextTab) {
        return { sourcesDrawerOpen: false };
      }
      return { sourcesDrawerOpen: true, sourcesDrawerTab: nextTab };
    });
  },

  setSelectedCitation: (citation) => {
    set({
      selectedCitation: citation,
      sourcesDrawerOpen: true,
      sourcesDrawerTab: 'sources'
    });
  },

  setHighRiskModalApproval: (approval) => set({ highRiskModalApproval: approval }),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setSimulatorOpen: (open) => set({ simulatorOpen: open }),

  setSpeedMultiplier: (speed) => set({ speedMultiplier: speed }),

  setForceNextError: (force) => set({ forceNextError: force }),

  addEventLog: (event) => {
    set((state) => ({
      eventLog: [
        {
          id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          raw: event,
        },
        ...state.eventLog.slice(0, 49),
      ],
    }));
  },

  clearEventLog: () => set({ eventLog: [] }),

  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set((state) => (state.toast?.message === message ? { toast: null } : state));
    }, 3200);
  },

  dismissToast: () => set({ toast: null }),

  setCurrentUser: (userId) => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) {
      try {
        localStorage.setItem(STORAGE_USER_KEY, user.id);
      } catch (e) {}
      set({ currentUser: user });
      get().showToast(`Switched active user to ${user.name} (${user.role})`, 'info');
    }
  },

  updateThreadTitle: (threadId, title) => {
    set((state) => {
      const updated = state.threads.map(t => 
        t.id === threadId ? { ...t, title } : t
      );
      try {
        localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { threads: updated };
    });
  },

  deleteThread: (threadId) => {
    set((state) => {
      const updated = state.threads.filter(t => t.id !== threadId);
      try {
        localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return {
        threads: updated,
        activeThreadId: state.activeThreadId === threadId ? null : state.activeThreadId,
      };
    });
    get().showToast('Conversation deleted', 'info');
  },

  moveThreadToProject: (threadId, newProjectId) => {
    set((state) => {
      const updated = state.threads.map(t => 
        t.id === threadId ? { ...t, projectId: newProjectId } : t
      );
      try {
        localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { threads: updated };
    });
    get().showToast(`Moved to ${newProjectId}`, 'success');
  },

  saveThreadToStorage: (threads) => {
    try {
      localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(threads));
    } catch (e) {}
  },

  refreshTickets: () => {
    set({ jiraTickets: getStoredTickets() });
  },

  addScheduledTask: (task) => {
    set((state) => {
      const updated = [task, ...state.scheduledTasks];
      try {
        localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { scheduledTasks: updated };
    });
    get().showToast(`Added "${task.name}" to Scheduled Tasks`, 'success');
  },

  toggleTaskStatus: (taskId) => {
    set((state) => {
      const updated = state.scheduledTasks.map(t => 
        t.id === taskId ? { ...t, status: t.status === 'active' ? 'paused' : 'active' } : t
      );
      try {
        localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { scheduledTasks: updated };
    });
  },

  resetAllData: () => {
    localStorage.removeItem(STORAGE_THREADS_KEY);
    localStorage.removeItem(STORAGE_TASKS_KEY);
    localStorage.removeItem('northwind_assistant_feedback');
    resetTickets();
    set({
      threads: INITIAL_THREADS,
      activeThreadId: null,
      currentUser: MOCK_USERS[0],
      scheduledTasks: INITIAL_SCHEDULED_TASKS,
      jiraTickets: getStoredTickets(),
      eventLog: [],
      streamingSteps: [],
      streamingTokens: '',
      streamingCitations: [],
    });
    get().showToast('Workspace data reset to pristine state', 'info');
  },
}));
