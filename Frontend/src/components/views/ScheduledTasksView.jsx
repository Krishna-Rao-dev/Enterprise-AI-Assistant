import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import {
  CalendarCheck2,
  Clock,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Tag
} from 'lucide-react';

export function ScheduledTasksView() {
  const { scheduledTasks, toggleTaskStatus, addScheduledTask, currentUser } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskSchedule, setNewTaskSchedule] = useState('Every Monday at 09:00 UTC');

  if (!apiClient.isMock) {
    return (
      <div className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6 pb-4 border-b border-border">
          <h2 className="text-xl font-semibold text-text">Scheduled Tasks</h2>
          <p className="text-xs text-muted mt-1">
            Scheduled-task APIs are not available in the backend.
          </p>
        </div>
        <div className="p-4 rounded-card bg-surface border border-border text-xs text-muted">
          No backend task data is available. The sample routines are shown only in simulation mode.
        </div>
      </div>
    );
  }

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    addScheduledTask({
      id: `st-${Date.now()}`,
      name: newTaskName.trim(),
      schedule: newTaskSchedule,
      nextRun: 'Next execution scheduled',
      status: 'active',
      owner: currentUser.name,
      category: 'Custom Routine',
    });

    setNewTaskName('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-text">Scheduled Tasks</h2>
          <p className="text-xs text-muted mt-1">
            Automated recurring knowledge audits, calendar syncs, and background reconciliation routines
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary-gradient flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-semibold shadow-sm self-start"
        >
          <Plus className="w-4 h-4" />
          <span>New routine</span>
        </button>
      </div>

      {/* Tasks Table / Cards */}
      {scheduledTasks.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-card border border-border bg-surface">
          <CalendarCheck2 className="w-10 h-10 text-faint mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-medium text-text">No scheduled routines</h4>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Create recurring background routines or approve high-impact assistant schedules to track them here.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-3 py-1.5 rounded-control bg-elevated border border-border text-xs text-primary font-medium hover:bg-hover"
          >
            Create your first routine
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduledTasks.map((task) => {
            const isActive = task.status === 'active';
            return (
              <div
                key={task.id}
                className="p-4 rounded-card bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-border-strong transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-success/15 text-success border border-success/30'
                        : 'bg-elevated text-muted border border-border'
                    }`}
                  >
                    {isActive ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-text">{task.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-elevated text-faint border border-border">
                        {task.category || 'Automation'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-muted font-mono">
                      <span>Schedule: <strong className="text-text font-normal">{task.schedule}</strong></span>
                      <span>Next run: <strong className="text-text font-normal">{task.nextRun}</strong></span>
                      <span>Owner: <strong className="text-text font-normal">{task.owner}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:self-center self-end">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      isActive ? 'text-success bg-success/10' : 'text-faint bg-elevated'
                    }`}
                  >
                    {task.status}
                  </span>

                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className="p-1.5 rounded-control bg-elevated hover:bg-hover border border-border text-text text-xs transition-colors"
                  >
                    {isActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Simple Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-strong rounded-card p-5 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-sm font-semibold text-text mb-3">Create Scheduled Routine</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1">Routine Name</label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="e.g. Daily Payment Ingress Verification"
                  className="w-full bg-elevated border border-border rounded-control p-2 text-text focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Schedule Interval</label>
                <select
                  value={newTaskSchedule}
                  onChange={(e) => setNewTaskSchedule(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-control p-2 text-text focus:outline-none focus:border-primary font-mono"
                >
                  <option value="Daily at 08:00 UTC">Daily at 08:00 UTC</option>
                  <option value="Every Monday at 09:00 UTC">Every Monday at 09:00 UTC</option>
                  <option value="Every 4 hours">Every 4 hours</option>
                  <option value="Monthly on 1st">Monthly on the 1st</option>
                </select>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-control text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-gradient px-4 py-1.5 rounded-control font-semibold">
                  Save routine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
