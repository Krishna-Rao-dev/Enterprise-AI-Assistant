import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { EmptyState } from './EmptyState';
import { Composer } from '../composer/Composer';
import { Shield, ArrowDown } from 'lucide-react';

export function MessageList() {
  const { activeThreadId, threads, showToast } = useAppStore();
  const currentThread = threads.find((t) => t.id === activeThreadId);

  const bottomRef = useRef(null);

  // Auto-scroll to bottom on streaming or new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThread?.messages]);

  useEffect(() => {
    if (apiClient.isMock || !currentThread || currentThread.messagesLoaded !== false) return undefined;

    let cancelled = false;
    Promise.all([
      apiClient.getThreadMessages(currentThread.id),
      apiClient.getPendingActions(currentThread.id),
    ])
      .then(([messages, pendingActions]) => {
        if (cancelled) return;
        if (pendingActions.length > 0) {
          const pending = pendingActions[0];
          let assistantIndex = -1;
          for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index].role === 'assistant') {
              assistantIndex = index;
              break;
            }
          }
          if (assistantIndex >= 0) {
            messages[assistantIndex] = {
              ...messages[assistantIndex],
              approval: {
                approval_id: pending.approval_id,
                action: pending.action,
                args: pending.args || {},
                risk: 'write',
                status: pending.status,
                expiresAt: Date.parse(pending.expires_at),
                createdAt: Date.now(),
              },
            };
          }
        }
        useAppStore.setState((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === currentThread.id
              ? { ...thread, messages, messagesLoaded: true }
              : thread
          ),
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load backend conversation messages', error);
          showToast(error.message || 'Failed to load conversation messages', 'error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentThread?.id, currentThread?.messagesLoaded, showToast]);

  // Check if any approval is pending in the current thread
  const pendingApprovalMessage = currentThread?.messages.find(
    (m) => m.approval && m.approval.status === 'pending'
  );

  const jumpToApproval = () => {
    if (pendingApprovalMessage) {
      const el = document.getElementById(`approval-card-${pendingApprovalMessage.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // If no thread is selected or thread has no messages, show EmptyState
  if (!currentThread || currentThread.messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Persistent subtle banner when an approval is pending */}
      {pendingApprovalMessage && (
        <div className="sticky top-0 z-10 w-full bg-primary/10 border-b border-primary/20 backdrop-blur-md px-4 py-2 flex items-center justify-between text-xs text-text animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">1 action waiting for your approval</span>
          </div>
          <button
            onClick={jumpToApproval}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-mono"
          >
            <span>Jump to card</span>
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-[760px] mx-auto space-y-4">
          {currentThread.messages.map((message, index) => {
            const isLast = index === currentThread.messages.length - 1;
            if (message.role === 'user') {
              return <UserMessage key={message.id || index} message={message} />;
            }
            return (
              <AssistantMessage
                key={message.id || index}
                message={message}
                isLast={isLast}
                threadId={currentThread.id}
              />
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Bottom Composer Container */}
      <div className="p-4 border-t border-border bg-bg/90 backdrop-blur-md flex-shrink-0">
        <div className="max-w-[760px] mx-auto">
          <Composer isFloating={false} ambientGlow={false} />
        </div>
      </div>
    </div>
  );
}
