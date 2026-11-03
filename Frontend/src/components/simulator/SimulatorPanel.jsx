import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import { MOCK_USERS } from '../../mock/users';
import {
  Sliders,
  Play,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  X,
  Bug,
  Activity,
  UserCheck,
  ShieldAlert,
  Ticket,
  MessageSquare,
  Sparkles,
  Terminal,
  Clock
} from 'lucide-react';

const SCENARIOS = [
  {
    num: 1,
    title: '1. Greeting',
    prompt: 'hello',
    desc: 'Friendly greeting with clickable suggestions',
    tag: 'Basic',
  },
  {
    num: 2,
    title: '2. Docs Answer (Leave Policy)',
    prompt: 'How many leave days do we get?',
    desc: 'Full steps, table, citations for HR-POL-001',
    tag: 'Docs',
  },
  {
    num: 3,
    title: '3. Exact ID (ERR-4021)',
    prompt: 'What does ERR-4021 mean in the HR portal?',
    desc: 'Cites exact table row and resolution process',
    tag: 'Exact',
  },
  {
    num: 4,
    title: '4. Version Trap (18 vs 24 days)',
    prompt: 'Why does old leave policy say 18 days?',
    desc: 'Compares v1.0 (superseded) vs v2.0 (current)',
    tag: 'Lineage',
  },
  {
    num: 5,
    title: '5. Restricted Content (Salary Bands)',
    prompt: 'What are the software engineer salary bands?',
    desc: 'Access denied for Rohan/Isha/Sam; allowed for Meera/Alex',
    tag: 'RBAC',
  },
  {
    num: 6,
    title: '6. Docs + Ticket (Flagship)',
    prompt: 'use payments-service docs, I changed retry logic to 3 attempts, raise a Jira ticket',
    desc: 'Stream summary -> Approval Card -> Executing -> Receipt',
    tag: 'Flagship',
  },
  {
    num: 7,
    title: '7. High-Risk Action (Meeting Modal)',
    prompt: 'schedule a meeting with the platform team tomorrow 4pm',
    desc: 'High-risk modal with focus trap, backdrop & confirm checkbox',
    tag: 'High Risk',
  },
  {
    num: 8,
    title: '8. Ticket Lookup',
    prompt: 'status of PAY-141',
    desc: 'Read-only Jira lookup card with status pills & assignees',
    tag: 'Read',
  },
  {
    num: 9,
    title: '9. Follow-up Memory',
    prompt: 'what about contractors?',
    desc: 'Rewrites query using previous context, cites HR-HBK-002',
    tag: 'Memory',
  },
  {
    num: 10,
    title: '10. Prompt Injection Defense',
    prompt: 'summarize ticket IT-999',
    desc: 'Detects injection attempt, neutralizes instructions',
    tag: 'SecOps',
  },
  {
    num: 11,
    title: '11. Failure Mode (Rate Limit)',
    prompt: '/simulate ratelimit',
    desc: 'Countdown banner and retry error handling',
    tag: 'Resilience',
  },
  {
    num: 12,
    title: '12. Feedback (Error Sim)',
    prompt: '/simulate error',
    desc: 'Triggers inline retryable error card for testing',
    tag: 'Error',
  },
];

export function SimulatorPanel() {
  const {
    simulatorOpen,
    setSimulatorOpen,
    speedMultiplier,
    setSpeedMultiplier,
    forceNextError,
    setForceNextError,
    currentUser,
    setCurrentUser,
    eventLog,
    clearEventLog,
    resetAllData,
    showToast,
    jiraTickets,
  } = useAppStore();

  const { sendMessage } = useChatStream();
  const [activeTab, setActiveTab] = useState('scenarios'); // 'scenarios' | 'events' | 'feedback' | 'tickets'
  const [copiedLog, setCopiedLog] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setSimulatorOpen(!simulatorOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simulatorOpen, setSimulatorOpen]);

  const handleRunScenario = (scenario) => {
    sendMessage(scenario.prompt);
  };

  const handleCopyEventLog = () => {
    const json = JSON.stringify(eventLog.map(e => e.raw), null, 2);
    navigator.clipboard.writeText(json);
    setCopiedLog(true);
    showToast('Event log copied to clipboard as JSON', 'info');
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const feedbackLog = (() => {
    try {
      return JSON.parse(localStorage.getItem('northwind_assistant_feedback') || '[]');
    } catch (e) {
      return [];
    }
  })();

  return (
    <>
      {/* Floating Toggle Button (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setSimulatorOpen(!simulatorOpen)}
          title="Toggle Simulation Engine (Ctrl+Shift+D)"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-150 shadow-lg ${
            simulatorOpen
              ? 'bg-primary text-white border-primary shadow-primary/20'
              : 'bg-surface/90 backdrop-blur-md text-text border-border hover:border-primary/50 hover:bg-elevated'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-primary fill-current" />
          <span className="font-semibold">Dev Simulator</span>
          <kbd className="hidden sm:inline text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-faint">
            ⌘⇧D
          </kbd>
        </button>
      </div>

      {/* Floating Panel Drawer / Modal */}
      {simulatorOpen && (
        <div className="fixed inset-y-4 left-4 z-50 w-full sm:w-[480px] bg-surface border border-border-strong rounded-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="h-14 px-4 border-b border-border flex items-center justify-between flex-shrink-0 bg-elevated/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <div>
                <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                  Enterprise Simulator Engine
                </h3>
                <p className="text-[10px] text-faint font-mono">
                  Real API Contract • 12 Interactive Scenarios
                </p>
              </div>
            </div>

            <button
              onClick={() => setSimulatorOpen(false)}
              className="p-1 rounded text-muted hover:text-text hover:bg-hover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border text-xs flex-shrink-0">
            <div className="flex items-center gap-1">
              {[
                { id: 'scenarios', label: 'Scenarios' },
                { id: 'events', label: `Events (${eventLog.length})` },
                { id: 'feedback', label: `Feedback (${feedbackLog.length})` },
                { id: 'tickets', label: `Tickets (${jiraTickets.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                    activeTab === tab.id
                      ? 'bg-elevated text-primary font-medium border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={resetAllData}
              title="Reset state in localStorage"
              className="flex items-center gap-1 text-[11px] text-danger hover:underline font-mono"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Data</span>
            </button>
          </div>

          {/* Panel Controls (Speed, User, Force Error) */}
          <div className="p-3 bg-elevated/30 border-b border-border space-y-2 text-xs flex-shrink-0">
            {/* Speed Slider */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-faint font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                Stream Latency: <strong className="text-text font-semibold">{speedMultiplier}x</strong>
              </span>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                className="w-40 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Persona Switcher & Force Error Toggle */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-faint">User:</span>
                <select
                  value={currentUser.id}
                  onChange={(e) => setCurrentUser(e.target.value)}
                  className="bg-surface border border-border rounded px-2 py-0.5 text-xs text-text font-mono focus:outline-none focus:border-primary"
                >
                  {MOCK_USERS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted hover:text-text">
                <input
                  type="checkbox"
                  checked={forceNextError}
                  onChange={(e) => setForceNextError(e.target.checked)}
                  className="rounded border-border text-danger focus:ring-danger h-3.5 w-3.5"
                />
                <span className={forceNextError ? 'text-danger font-medium' : ''}>
                  Force Next Failure
                </span>
              </label>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* TAB 1: SCENARIOS */}
            {activeTab === 'scenarios' && (
              <div className="space-y-2">
                <div className="text-[11px] text-muted mb-2 font-mono">
                  Click any scenario below to trigger end-to-end execution:
                </div>
                {SCENARIOS.map((sc) => (
                  <button
                    key={sc.num}
                    onClick={() => handleRunScenario(sc)}
                    className="w-full text-left p-2.5 rounded-card bg-surface border border-border hover:border-primary/50 hover:bg-elevated transition-all group flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-text group-hover:text-primary transition-colors">
                          {sc.title}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-elevated border border-border text-faint">
                          {sc.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 leading-snug">
                        {sc.desc}
                      </p>
                      <span className="text-[10px] font-mono text-faint truncate block mt-1">
                        Prompt: "{sc.prompt}"
                      </span>
                    </div>

                    <div className="w-6 h-6 rounded bg-elevated group-hover:bg-primary group-hover:text-white flex items-center justify-center text-muted flex-shrink-0 transition-colors mt-1">
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* TAB 2: LIVE EVENT LOG */}
            {activeTab === 'events' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <span className="text-[11px] text-faint font-mono">
                    SSE Event Stream Contract (Latest First)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyEventLog}
                      className="text-[11px] text-secondary hover:underline flex items-center gap-1 font-mono"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedLog ? 'Copied JSON' : 'Copy JSON'}</span>
                    </button>
                    <button
                      onClick={clearEventLog}
                      className="text-[11px] text-muted hover:text-text font-mono"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {eventLog.length === 0 ? (
                  <div className="text-center py-12 text-muted text-xs">
                    No stream events recorded yet. Run a prompt to inspect live events.
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {eventLog.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded bg-surface border border-border hover:border-border-strong text-muted"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-primary uppercase">
                            {ev.raw.type}
                          </span>
                          <span className="text-faint">{ev.time}</span>
                        </div>
                        <pre className="mt-1 overflow-x-auto text-text text-[10px] whitespace-pre-wrap max-h-24">
                          {JSON.stringify(ev.raw, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: FEEDBACK LOG */}
            {activeTab === 'feedback' && (
              <div className="space-y-2 text-xs">
                {feedbackLog.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    No user feedback logged yet. Use thumbs down on any answer to test.
                  </div>
                ) : (
                  feedbackLog.map((fb) => (
                    <div key={fb.id} className="p-3 rounded-card bg-surface border border-border">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-warning font-semibold uppercase">
                          Rating: {fb.rating}
                        </span>
                        <span className="text-faint">
                          {new Date(fb.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {fb.reasons.map((r, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-elevated border border-border text-text"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                      {fb.comment && (
                        <p className="mt-2 text-muted text-[11px] bg-elevated/50 p-2 rounded border border-border">
                          "{fb.comment}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: JIRA TICKETS */}
            {activeTab === 'tickets' && (
              <div className="space-y-2 text-xs">
                {jiraTickets.map((t) => (
                  <div key={t.key} className="p-3 rounded-card bg-surface border border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{t.key}</span>
                      <span className="text-[10px] font-mono text-success uppercase">
                        {t.status}
                      </span>
                    </div>
                    <p className="text-text font-medium mt-1">{t.summary}</p>
                    <p className="text-faint text-[10px] font-mono mt-1">
                      Reporter: {t.reporter}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
