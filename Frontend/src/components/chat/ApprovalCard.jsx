import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import { apiClient } from '../../api/client';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RotateCcw,
  Check,
  Eye,
  Edit3
} from 'lucide-react';

export function ApprovalCard({ approval, messageId, threadId }) {
  const { currentUser, showToast } = useAppStore();
  const { handleApprovalDecision } = useChatStream();

  const [project, setProject] = useState(
    approval.args.project_key || approval.args.project || ''
  );
  const [summary, setSummary] = useState(approval.args.summary || '');
  const [description, setDescription] = useState(approval.args.description || '');
  const [priority, setPriority] = useState(approval.args.priority || 'Medium');
  const [startDate, setStartDate] = useState(approval.args.start_date || '');
  const [endDate, setEndDate] = useState(approval.args.end_date || '');
  const [reason, setReason] = useState(approval.args.reason || '');
  const [showPreview, setShowPreview] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isExpired, setIsExpired] = useState(approval.status === 'expired');
  const isLeaveRequest = approval.action === 'hr_submit_leave_request';
  const actionTitle = isLeaveRequest ? 'Submit HR leave request' : 'Create Jira ticket';

  const status = isExpired && ['pending', 'expired'].includes(approval.status)
    ? 'expired'
    : approval.status; // pending | submitting | executing | success | rejected | expired | failed

  useEffect(() => {
    if (status !== 'pending') return;

    const expiresAt = approval.expiresAt || (approval.createdAt || Date.now()) + 90000;
    const remaining = Math.max(0, expiresAt - Date.now());

    const timer = setTimeout(() => {
      setIsExpired(true);
    }, remaining);

    return () => clearTimeout(timer);
  }, [status, approval.createdAt, approval.expiresAt]);

  // Keyboard shortcut: Cmd/Ctrl+Enter to approve, Esc to reject
  useEffect(() => {
    if (status !== 'pending') return;

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleReject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, summary, description, priority, project]);

  const handleApprove = () => {
    if (isLeaveRequest && (!startDate || !endDate || !reason.trim())) {
      setValidationError('Start date, end date, and reason are required');
      return;
    }
    if (!isLeaveRequest && !summary.trim()) {
      setValidationError('Summary is required');
      return;
    }
    setValidationError('');

    handleApprovalDecision({
      threadId,
      messageId,
      approvalId: approval.approval_id,
      decision: 'approve',
      action: approval.action || 'create_ticket',
      args: isLeaveRequest
        ? { start_date: startDate, end_date: endDate, reason: reason.trim() }
        : {
            project,
            project_key: project,
            summary: summary.trim(),
            description: description.trim(),
            priority,
            reporter: `${currentUser.name} (${currentUser.email})`,
            based_on: approval.based_on,
          },
    });
  };

  const handleReject = () => {
    handleApprovalDecision({
      threadId,
      messageId,
      approvalId: approval.approval_id,
      decision: 'reject',
      action: approval.action || 'create_ticket',
    });
  };

  const handleRedraft = () => {
    setIsExpired(false);
    // Reset to pending
    useAppStore.setState((state) => {
      const updatedThreads = state.threads.map(t => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          messages: t.messages.map(m => {
            if (m.id !== messageId || !m.approval) return m;
            return {
              ...m,
              approval: {
                ...m.approval,
                status: 'pending',
                createdAt: Date.now(),
              },
            };
          }),
        };
      });
      return { threads: updatedThreads };
    });
    showToast('Re-opened approval draft', 'info');
  };

  // 1. SUCCESS STATE: Compact Receipt
  if (status === 'success') {
    const receipt = approval.receipt || {};
    return (
      <div className="my-3 p-3.5 rounded-card bg-surface border border-success/30 flex items-center justify-between animate-in fade-in-50 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text">
                Action Completed: {receipt.ticket_key
                  ? `Created ${receipt.ticket_key}`
                  : receipt.request_id
                    ? 'Leave request submitted'
                    : 'Scheduled'}
              </span>
              <span className="text-[10px] font-mono text-faint">{receipt.time}</span>
            </div>
            <p className="text-[11px] text-muted mt-0.5 truncate max-w-md">
              {isLeaveRequest
                ? `${approval.receipt?.start_date || approval.args.start_date || startDate} – ${approval.receipt?.end_date || approval.args.end_date || endDate}`
                : summary || approval.args.summary}
            </p>
          </div>
        </div>

        {receipt.url && (
          <a
            href={receipt.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium bg-elevated hover:bg-hover border border-border text-primary hover:text-white transition-colors"
          >
            <span>View in Jira</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  }

  // 2. REJECTED STATE: Muted Card with Redraft
  if (status === 'rejected') {
    return (
      <div className="my-3 p-3.5 rounded-card bg-surface/60 border border-border flex items-center justify-between text-xs text-muted animate-in fade-in-50">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-faint" />
          <span>
            {isLeaveRequest
              ? 'You rejected this write action. No leave request was submitted.'
              : 'You rejected this write action. No Jira ticket was created.'}
          </span>
        </div>
        {apiClient.isMock && (
          <button
            onClick={handleRedraft}
            className="text-primary hover:underline font-medium text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Redraft</span>
          </button>
        )}
      </div>
    );
  }

  // 3. EXPIRED STATE
  if (status === 'expired') {
    return (
      <div className="my-3 p-3.5 rounded-card bg-surface/60 border border-warning/30 flex items-center justify-between text-xs text-muted animate-in fade-in-50">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-warning" />
          <span className="text-text">This approval request has expired.</span>
        </div>
        {apiClient.isMock ? (
          <button
            onClick={handleRedraft}
            className="px-2.5 py-1 rounded-control bg-elevated text-primary hover:text-white border border-border transition-colors font-medium"
          >
            Re-request
          </button>
        ) : (
          <button
            onClick={() => handleApprovalDecision({
              threadId,
              messageId,
              approvalId: approval.approval_id,
              decision: 'reject',
              action: approval.action,
            })}
            className="px-2.5 py-1 rounded-control bg-elevated text-primary hover:text-white border border-border transition-colors font-medium"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  // 4. PENDING / SUBMITTING / EXECUTING STATE
  const isExecuting = status === 'submitting' || status === 'executing';

  return (
    <div
      id={`approval-card-${messageId}`}
      className="my-4 rounded-card bg-surface border-l-4 border-l-primary border-t border-r border-b border-border shadow-xl p-4 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          {/* Jira Logo Glyph */}
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.35 4.35 0 0 0 4.35 4.35V7.63a.84.84 0 0 0-.84-.84H6.77zM2 11.6a4.35 4.35 0 0 0 4.35 4.35h1.78v1.72a4.35 4.35 0 0 0 4.35 4.35v-9.59a.84.84 0 0 0-.84-.84H2z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                {actionTitle}
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center gap-1 font-semibold">
                <Shield className="w-2.5 h-2.5" />
                Needs your approval
              </span>
            </div>
            <p className="text-[11px] text-faint mt-0.5">
              Review the proposed write before it is sent to the connected service.
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
          Write action
        </span>
      </div>

      {/* Form Body: Key-Value Layout */}
      <div className="py-3.5 space-y-3 text-xs">
        {isLeaveRequest ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[11px] font-mono text-faint">
                Start date
                <input
                  type="date"
                  disabled={isExecuting}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
                />
              </label>
              <label className="text-[11px] font-mono text-faint">
                End date
                <input
                  type="date"
                  disabled={isExecuting}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
                />
              </label>
            </div>
            <label className="block text-[11px] font-mono text-faint">
              Reason
              <textarea
                disabled={isExecuting}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
              />
            </label>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[11px] font-mono text-faint">
                Project Key
                <input
                  disabled={isExecuting}
                  maxLength={10}
                  value={project}
                  onChange={(event) => setProject(event.target.value.toUpperCase())}
                  className="mt-1 w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
                />
              </label>
              <label className="text-[11px] font-mono text-faint">
                Priority
                <select
                  disabled={isExecuting}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="mt-1 w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
                >
                  <option value="Highest">Highest</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Lowest">Lowest</option>
                </select>
              </label>
            </div>
            <label className="block text-[11px] font-mono text-faint">
              Summary
              <input
                disabled={isExecuting}
                maxLength={120}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="mt-1 w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
              />
            </label>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-faint">Description</label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                >
                  {showPreview ? (
                    <><Edit3 className="w-3 h-3" /><span>Edit Raw</span></>
                  ) : (
                    <><Eye className="w-3 h-3" /><span>Preview</span></>
                  )}
                </button>
              </div>
              {showPreview ? (
                <div className="w-full bg-elevated/70 border border-border rounded-control p-2.5 text-xs text-muted max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {description}
                </div>
              ) : (
                <textarea
                  disabled={isExecuting}
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full bg-elevated border border-border rounded-control px-2.5 py-1.5 text-xs text-text"
                />
              )}
            </div>
          </>
        )}
        {validationError && (
          <p className="text-[11px] text-danger mt-1">{validationError}</p>
        )}

        {/* "Based on" Sources Row */}
        {approval.based_on && approval.based_on.length > 0 && (
          <div className="pt-1 flex items-center gap-2 text-[11px]">
            <span className="text-faint font-mono">Based on:</span>
            <div className="flex flex-wrap gap-1">
              {approval.based_on.map((docId) => (
                <span
                  key={docId}
                  className="px-1.5 py-0.5 rounded bg-elevated border border-border font-mono text-[10px] text-primary"
                >
                  {docId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Approve, Edit implicitly supported, Reject */}
      <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
        <div className="text-[10px] text-faint font-mono hidden sm:block">
          <span>Keyboard: </span>
          <kbd className="bg-elevated px-1 py-0.5 rounded border border-border">⌘↵</kbd>
          <span> approve • </span>
          <kbd className="bg-elevated px-1 py-0.5 rounded border border-border">Esc</kbd>
          <span> reject</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={isExecuting}
            onClick={handleReject}
            className="px-3 py-1.5 rounded-control text-xs text-muted hover:text-text hover:bg-hover transition-colors disabled:opacity-50"
          >
            Reject
          </button>

          <button
            type="button"
            disabled={isExecuting}
            onClick={handleApprove}
            className="btn-primary-gradient flex items-center gap-2 px-4 py-1.5 rounded-control text-xs font-semibold shadow-md"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isLeaveRequest ? 'Submitting request...' : 'Writing to Jira...'}</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{isLeaveRequest ? 'Approve and submit' : 'Approve and create'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
