import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  Calendar,
  Users,
  Clock,
  FileText,
  X,
  Check,
  Loader2,
  Lock
} from 'lucide-react';

export function HighRiskApprovalModal() {
  const { highRiskModalApproval, setHighRiskModalApproval, currentUser } = useAppStore();
  const { handleApprovalDecision } = useChatStream();

  const [confirmed, setConfirmed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    setConfirmed(false);
    setIsExecuting(false);
  }, [highRiskModalApproval]);

  if (!highRiskModalApproval) return null;

  const args = highRiskModalApproval.args || {};
  const impactCount = args.impactCount || 6;

  const handleApprove = () => {
    if (!confirmed || isExecuting) return;
    setIsExecuting(true);

    handleApprovalDecision({
      threadId: highRiskModalApproval.threadId,
      messageId: highRiskModalApproval.messageId,
      decision: 'approve',
      action: highRiskModalApproval.action || 'schedule_meeting',
      args: {
        ...args,
        confirmed: true,
      },
    });
  };

  const handleReject = () => {
    handleApprovalDecision({
      threadId: highRiskModalApproval.threadId,
      messageId: highRiskModalApproval.messageId,
      decision: 'reject',
      action: highRiskModalApproval.action || 'schedule_meeting',
    });
    setHighRiskModalApproval(null);
  };

  return (
    <Dialog.Root open={!!highRiskModalApproval} onOpenChange={(open) => !open && handleReject()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-150" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-surface border border-border-strong rounded-card p-6 shadow-2xl focus:outline-none animate-in zoom-in-95 duration-150">
          {/* Header with High Risk Badge */}
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center text-danger flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Dialog.Title className="text-sm font-semibold text-text uppercase tracking-wider">
                    High-Impact Action
                  </Dialog.Title>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-danger/15 text-danger border border-danger/30 font-semibold">
                    Risk: High
                  </span>
                </div>
                <Dialog.Description className="text-xs text-muted mt-0.5">
                  This action dispatches calendar invites and impacts team schedules.
                </Dialog.Description>
              </div>
            </div>

            <button
              onClick={handleReject}
              className="p-1 rounded text-muted hover:text-text hover:bg-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details Body */}
          <div className="py-4 space-y-3.5 text-xs">
            <div className="p-3 rounded-control bg-elevated border border-border space-y-2">
              <div className="flex items-center gap-2 text-text font-medium">
                <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{args.title || 'Platform Team Sync'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted text-[11px] font-mono">
                <Clock className="w-3.5 h-3.5 text-faint flex-shrink-0" />
                <span>{args.time || 'Tomorrow at 4:00 PM - 4:45 PM (IST)'}</span>
              </div>
            </div>

            {/* Attendees Preview */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-faint font-mono mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  Impacted Attendees ({impactCount})
                </span>
                <span className="text-warning">Calendar conflict check passed</span>
              </div>
              <div className="bg-elevated border border-border rounded-control p-2.5 max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] text-muted">
                {args.attendees ? (
                  args.attendees.map((att, i) => (
                    <div key={i} className="truncate">
                      • {att}
                    </div>
                  ))
                ) : (
                  <>
                    <div>• platform-leads@northwind.internal (3 members)</div>
                    <div>• payments-core@northwind.internal (2 members)</div>
                    <div>• {currentUser.email} (Organizer)</div>
                  </>
                )}
              </div>
            </div>

            {/* Agenda */}
            <div>
              <span className="text-[11px] font-mono text-faint block mb-1">Proposed Agenda</span>
              <div className="p-2.5 rounded-control bg-elevated border border-border text-[11px] text-muted leading-relaxed font-sans">
                {args.agenda || 'Review retry backoff jitter implementation, 3-attempt cap, and Redis distributed lock timeouts.'}
              </div>
            </div>

            {/* Extra Confirm Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-control bg-danger/5 border border-danger/20 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-xs text-text leading-snug">
                I understand this will schedule a meeting for <strong>{impactCount} team members</strong> and reserve production calendar blocks.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleReject}
              disabled={isExecuting}
              className="px-3.5 py-1.5 rounded-control text-xs text-muted hover:text-text hover:bg-hover transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!confirmed || isExecuting}
              onClick={handleApprove}
              className="btn-primary-gradient flex items-center gap-2 px-4 py-1.5 rounded-control text-xs font-semibold shadow-lg disabled:opacity-40"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching invites...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm and dispatch</span>
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
