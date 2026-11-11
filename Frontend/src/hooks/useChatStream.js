import { useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { apiClient } from '../api/client';

export function useChatStream() {
  const abortControllerRef = useRef(null);

  const sendMessage = useCallback(async (content, options = {}) => {
    const store = useAppStore.getState();
    const {
      threads,
      activeThreadId,
      selectedProject,
      currentUser,
      speedMultiplier,
      forceNextError,
      addEventLog,
      showToast,
      saveThreadToStorage,
      addScheduledTask,
    } = store;

    // Reset force error flag if set
    if (forceNextError) {
      useAppStore.setState({ forceNextError: false });
    }

    // Determine target thread
    let currentThreadId = activeThreadId;
    let targetThread;

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    if (!currentThreadId) {
      // Create new thread
      currentThreadId = `thread-${Date.now()}`;
      // Title will be auto-generated or initial snippet
      const initialTitle = content.trim().length > 38 
        ? content.trim().slice(0, 38) + '...' 
        : content.trim();

      targetThread = {
        id: currentThreadId,
        projectId: selectedProject,
        title: initialTitle,
        updatedAt: new Date().toISOString(),
        displayTime: 'Just now',
        hasUnread: false,
        messages: [userMessage],
      };

      const updatedThreads = [targetThread, ...threads];
      useAppStore.setState({
        threads: updatedThreads,
        activeThreadId: currentThreadId,
        activeView: 'chat',
      });
      saveThreadToStorage(updatedThreads);
    } else {
      // Append user message to existing thread
      const existingThread = threads.find(t => t.id === currentThreadId);
      if (!existingThread) return;

      targetThread = {
        ...existingThread,
        updatedAt: new Date().toISOString(),
        displayTime: 'Just now',
        messages: [...existingThread.messages, userMessage],
      };

      const updatedThreads = threads.map(t => t.id === currentThreadId ? targetThread : t);
      useAppStore.setState({ threads: updatedThreads });
      saveThreadToStorage(updatedThreads);
    }

    // Prepare placeholder assistant message
    const assistantMessageId = `asst-${Date.now()}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      steps: [],
      citations: [],
      approval: null,
      error: null,
      suggestions: null,
      ticketLookup: null,
      isStreaming: true,
    };

    // Append initial assistant message
    useAppStore.setState((state) => {
      const updatedThreads = state.threads.map(t => {
        if (t.id === currentThreadId) {
          return {
            ...t,
            messages: [...t.messages, assistantMessage],
          };
        }
        return t;
      });
      return {
        threads: updatedThreads,
        isStreaming: true,
      };
    });

    const isCancelled = { value: false };
    const streamController = new AbortController();
    abortControllerRef.current = {
      abort: () => {
        isCancelled.value = true;
        streamController.abort();
      }
    };

    try {
      const stream = apiClient.chatStream({
        threadId: currentThreadId,
        message: content,
        project: selectedProject,
        mentions: options.mentions || [],
        user: currentUser,
        previousMessages: targetThread.messages,
        speedMultiplier,
        forceError: forceNextError,
        onEvent: (event) => addEventLog(event),
        signal: streamController.signal,
      });

      for await (const event of stream) {
        if (isCancelled.value) {
          break;
        }

        useAppStore.setState((state) => {
          const currentViewingId = state.activeThreadId;
          const updatedThreads = state.threads.map(t => {
            if (t.id !== currentThreadId) return t;

            const updatedMessages = t.messages.map(m => {
              if (m.id !== assistantMessageId) return m;

              if (event.type === 'token') {
                return {
                  ...m,
                  content: (m.content || '') + event.text,
                };
              }

              if (event.type === 'step') {
                const existingSteps = m.steps || [];
                const stepIdx = existingSteps.findIndex(s => s.id === event.id);
                let newSteps;
                if (stepIdx >= 0) {
                  newSteps = [...existingSteps];
                  newSteps[stepIdx] = { ...newSteps[stepIdx], ...event };
                } else {
                  newSteps = [...existingSteps, event];
                }
                return {
                  ...m,
                  steps: newSteps,
                };
              }

              if (event.type === 'sources') {
                return {
                  ...m,
                  citations: event.items || [],
                };
              }

              if (event.type === 'interrupt') {
                const approval = {
                  action: event.action,
                  approval_id: event.approval_id,
                  risk: event.risk || 'write',
                  args: event.args || {},
                  locked: event.locked || {},
                  based_on: event.based_on || [],
                  status: 'pending', // 'pending' | 'submitting' | 'approved' | 'rejected' | 'expired' | 'failed'
                  expiresAt: event.expires_at ? new Date(event.expires_at).getTime() : null,
                  createdAt: Date.now(),
                };

                if (event.risk === 'high') {
                  // Trigger high-risk modal dialog
                  state.setHighRiskModalApproval({
                    messageId: m.id,
                    threadId: currentThreadId,
                    ...approval,
                  });
                }

                return {
                  ...m,
                  approval,
                };
              }

              if (event.type === 'access_denied') {
                return {
                  ...m,
                  accessDenied: {
                    user: event.user,
                    reason: event.reason,
                    requiredGroup: event.requiredGroup,
                  },
                };
              }

              if (event.type === 'suggestions') {
                return {
                  ...m,
                  suggestions: event.items,
                };
              }

              if (event.type === 'ticket_lookup') {
                return {
                  ...m,
                  ticketLookup: event.tickets,
                };
              }

              if (event.type === 'error') {
                return {
                  ...m,
                  error: {
                    code: event.code,
                    message: event.message,
                    retryAfterSec: event.retryAfterSec,
                  },
                };
              }

              return m;
            });

            // Mark unread dot if user navigated to another thread while this was streaming!
            const isBackgroundThread = currentViewingId !== currentThreadId;

            return {
              ...t,
              hasUnread: isBackgroundThread ? true : t.hasUnread,
              messages: updatedMessages,
            };
          });

          return { threads: updatedThreads };
        });
      }
    } catch (err) {
      if (!isCancelled.value) {
        console.error('Chat stream error', err);
        useAppStore.setState((state) => {
          const updatedThreads = state.threads.map(t => {
            if (t.id !== currentThreadId) return t;
            return {
              ...t,
              messages: t.messages.map(m => {
                if (m.id !== assistantMessageId) return m;
                return {
                  ...m,
                  error: {
                    code: err.code || 'STREAM_FAILED',
                    message: err.message || 'An unexpected stream failure occurred.',
                  },
                };
              }),
            };
          });
          return { threads: updatedThreads };
        });
      }
    } finally {
      // Mark stream finished and finalize title
      useAppStore.setState((state) => {
        const updatedThreads = state.threads.map(t => {
          if (t.id !== currentThreadId) return t;

          // Auto-generate concise thread title from query if it's the first turn
          let finalTitle = t.title;
          if (t.messages.length <= 2) {
            const clean = content.replace(/^(hi|hello|hey|use payments-service docs|raise a jira ticket)[,\s]*/i, '').trim();
            if (clean.length > 5) {
              finalTitle = clean.slice(0, 36) + (clean.length > 36 ? '...' : '');
            }
          }

          return {
            ...t,
            title: finalTitle,
            messages: t.messages.map(m => 
              m.id === assistantMessageId ? { ...m, isStreaming: false } : m
            ),
          };
        });

        saveThreadToStorage(updatedThreads);
        return {
          threads: updatedThreads,
          isStreaming: false,
        };
      });
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      useAppStore.setState({ isStreaming: false });
    }
  }, []);

  // Handle Human-In-The-Loop Approval / Rejection
  const handleApprovalDecision = useCallback(async ({
    threadId,
    messageId,
    decision, // 'approve' | 'reject'
    args,
    action,
    approvalId,
  }) => {
    const store = useAppStore.getState();
    const { speedMultiplier, addEventLog, showToast, saveThreadToStorage, addScheduledTask, refreshTickets } = store;
    const pendingApprovalId = approvalId || store.threads
      .find((thread) => thread.id === threadId)
      ?.messages.find((message) => message.id === messageId)
      ?.approval?.approval_id;
    const isMock = apiClient.isMock;

    // Immediately update status to 'submitting' if approving or 'rejected' if rejecting
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
                args: args || m.approval.args,
                status: decision === 'approve' || !isMock ? 'submitting' : 'rejected',
              },
            };
          }),
        };
      });
      return { threads: updatedThreads };
    });

    if (decision === 'reject' && isMock) {
      showToast('Action rejected', 'info');
      return;
    }

    try {
      const resumeStream = apiClient.chatResume({
        threadId,
        approvalId: pendingApprovalId,
        decision,
        args,
        action,
        speedMultiplier,
        onEvent: (event) => addEventLog(event),
      });

      for await (const event of resumeStream) {
        if (event.type === 'token') {
          useAppStore.setState((state) => ({
            threads: state.threads.map((thread) => thread.id !== threadId
              ? thread
              : {
                  ...thread,
                  messages: thread.messages.map((message) => (
                    message.id !== messageId
                      ? message
                      : { ...message, content: `${message.content || ''}${event.text}` }
                  )),
                }),
          }));
        }

        if (event.type === 'executing') {
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
                      status: 'executing',
                      executingLabel: event.label,
                    },
                  };
                }),
              };
            });
            return { threads: updatedThreads };
          });
        }

        if (event.type === 'result') {
          if (isMock) refreshTickets();
          if (event.status === 'rejected') {
            useAppStore.setState((state) => ({
              threads: state.threads.map((thread) => thread.id !== threadId
                ? thread
                : {
                    ...thread,
                    messages: thread.messages.map((message) => (
                      message.id !== messageId || !message.approval
                        ? message
                        : {
                            ...message,
                            approval: { ...message.approval, status: 'rejected' },
                          }
                    )),
                  }),
            }));
            showToast('Action rejected', 'info');
            continue;
          }
          if (event.status === 'success') {
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
                        status: 'success',
                        receipt: {
                          ticket_key: event.ticket_key,
                          request_id: event.request_id,
                          meeting_title: event.meeting_title,
                          scheduled_time: event.scheduled_time,
                          url: event.url,
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                      },
                    };
                  }),
                };
              });

              saveThreadToStorage(updatedThreads);
              return {
                threads: updatedThreads,
                highRiskModalApproval: null,
              };
            });

            if (event.request_id) {
              showToast(`Leave request submitted (${event.request_id})`, 'success');
            } else if (event.meeting_title) {
              addScheduledTask({
                id: `st-${Date.now()}`,
                name: event.meeting_title,
                schedule: event.scheduled_time || 'Tomorrow at 4:00 PM (IST)',
                nextRun: 'Tomorrow at 16:00 IST',
                status: 'active',
                owner: store.currentUser.name,
                category: 'Calendar Sync',
              });
              showToast(`Scheduled "${event.meeting_title}" & added to Scheduled Tasks`, 'success');
            } else {
              showToast(`Ticket ${event.ticket_key} successfully created in Jira!`, 'success');
            }
          }
        }
      }
    } catch (err) {
      console.error('Resume approval failed', err);
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
                  status: 'failed',
                  error: err.message,
                },
              };
            }),
          };
        });
        return { threads: updatedThreads };
      });
      showToast('Action execution failed. You can retry.', 'error');
    }
  }, []);

  return {
    sendMessage,
    stopStreaming,
    handleApprovalDecision,
  };
}
