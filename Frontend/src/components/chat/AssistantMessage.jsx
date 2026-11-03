import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import { apiClient } from '../../api/client';
import { ActivityTimeline } from './ActivityTimeline';
import { CitationChip } from './CitationChip';
import { ApprovalCard } from './ApprovalCard';
import { AccessDeniedCard } from './AccessDeniedCard';
import { TicketCard } from './TicketCard';
import { FeedbackPanel } from './FeedbackPanel';
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  AlertCircle,
  Flag
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function AssistantMessage({ message, isLast = false, threadId }) {
  const { showToast, threads } = useAppStore();
  const { sendMessage } = useChatStream();

  const [copied, setCopied] = useState(false);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [ratedUp, setRatedUp] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const getMessageIndex = () => {
    const thread = threads.find((item) => item.id === threadId);
    return thread?.messages
      .filter((item) => item.role === 'assistant')
      .findIndex((item) => item.id === message.id) ?? -1;
  };

  const handleThumbsUp = async () => {
    try {
      await apiClient.submitFeedback({
        messageId: message.id,
        threadId,
        messageIndex: getMessageIndex(),
        rating: 'up',
      });
      setRatedUp(true);
      showToast('Thank you for rating this response helpful', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to submit feedback', 'error');
    }
  };

  const handleRegenerate = () => {
    const thread = useAppStore.getState().threads.find((t) => t.id === threadId);
    if (!thread) return;
    const lastUserMsg = [...thread.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  };

  // Helper to replace text like [[DOC-ID §section]] with CitationChip
  const renderContentWithCitations = (content) => {
    if (!content) return null;

    const parts = content.split(/(\[\[[A-Z0-9-]+(?:\s+§[^\]]+)?\]\]|\[[A-Z0-9-]+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[\[([A-Z0-9-]+)(?:\s+(§[^\]]+))?\]\]$/)
        || part.match(/^\[([A-Z0-9-]+)\]$/);
      if (match) {
        const docId = match[1];
        const section = match[2];
        const matchedCitation = message.citations?.find((c) => c.doc_id === docId);
        return (
          <CitationChip
            key={index}
            citation={matchedCitation}
            label={section ? `${docId} ${section}` : docId}
          />
        );
      }
      return (
        <ReactMarkdown
          key={index}
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const text = String(children).replace(/\n$/, '');
              if (inline) {
                return (
                  <code className="font-mono text-[13px] bg-elevated border border-border px-1.5 py-0.5 rounded text-primary" {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <div className="relative group/code my-3 rounded-card border border-border bg-[#07070A] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-elevated border-b border-border text-[11px] font-mono text-faint">
                    <span>code</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(text);
                        showToast('Code copied', 'info');
                      }}
                      className="flex items-center gap-1 hover:text-text transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-3 overflow-x-auto font-mono text-xs leading-relaxed text-[#ECECF3]">
                    <code>{text}</code>
                  </pre>
                </div>
              );
            },
          }}
        >
          {part}
        </ReactMarkdown>
      );
    });
  };

  return (
    <div className="w-full my-6 text-sm text-text select-text animate-in fade-in-50 duration-200">
      {/* Activity Timeline (if steps exist) */}
      {message.steps && message.steps.length > 0 && (
        <ActivityTimeline steps={message.steps} isStreaming={message.isStreaming} />
      )}

      {/* Access Denied Card */}
      {message.accessDenied && (
        <AccessDeniedCard accessDenied={message.accessDenied} />
      )}

      {/* Ticket Lookup Table Card */}
      {message.ticketLookup && (
        <TicketCard tickets={message.ticketLookup} />
      )}

      {/* Main Markdown Text with Serif Headings */}
      {message.content && (
        <div className="prose-assistant font-sans leading-relaxed">
          {renderContentWithCitations(message.content)}
          {message.isStreaming && <span className="streaming-caret" />}
        </div>
      )}

      {/* Human-In-The-Loop Approval Card */}
      {message.approval && (
        <ApprovalCard
          approval={message.approval}
          messageId={message.id}
          threadId={threadId}
        />
      )}

      {/* Inline Error Card with Retry */}
      {message.error && (
        <div className="my-3 p-3.5 rounded-card bg-danger/10 border border-danger/30 flex items-start justify-between gap-3 text-xs text-danger">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold block font-mono text-[11px]">
                {message.error.code}
              </span>
              <p className="mt-0.5 text-text leading-snug">{message.error.message}</p>
              {message.error.retryAfterSec && (
                <span className="text-[10px] text-faint font-mono block mt-1">
                  Automatic retry available in {message.error.retryAfterSec}s
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleRegenerate}
            className="px-2.5 py-1 rounded bg-surface border border-danger/40 text-text hover:bg-danger/20 font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Suggestion Chips */}
      {message.suggestions && message.suggestions.length > 0 && !message.isStreaming && (
        <div className="mt-4 pt-2 flex flex-wrap gap-2">
          {message.suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => sendMessage(suggestion)}
              className="px-3 py-1.5 rounded-full text-xs bg-surface border border-border hover:border-primary/50 hover:bg-elevated text-muted hover:text-text transition-colors text-left"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Message Actions (Visible on hover, always visible on last message) */}
      {!message.isStreaming && (
        <div
          className={`mt-3 flex items-center gap-1 text-faint transition-opacity duration-150 ${
            isLast ? 'opacity-100' : 'opacity-0 hover:opacity-100'
          }`}
        >
          <button
            onClick={handleCopy}
            title="Copy message"
            className="p-1.5 rounded hover:text-text hover:bg-hover transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleRegenerate}
            title="Regenerate response"
            className="p-1.5 rounded hover:text-text hover:bg-hover transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleThumbsUp}
            title="Helpful"
            className={`p-1.5 rounded hover:bg-hover transition-colors ${
              ratedUp ? 'text-success' : 'hover:text-text'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setFeedbackPanelOpen(!feedbackPanelOpen)}
            title="Provide feedback"
            className="p-1.5 rounded hover:text-text hover:bg-hover transition-colors"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="Message overflow actions"
                className="p-1.5 rounded hover:text-text hover:bg-hover transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={4}
                className="z-50 w-44 bg-surface border border-border-strong rounded-control p-1 text-xs shadow-xl"
              >
                <DropdownMenu.Item
                  onClick={() => setFeedbackPanelOpen(true)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 cursor-pointer outline-none"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Report wrong answer
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}

      {/* Inline Feedback Panel */}
      {feedbackPanelOpen && (
        <FeedbackPanel
          messageId={message.id}
          threadId={threadId}
          messageIndex={getMessageIndex()}
          onClose={() => setFeedbackPanelOpen(false)}
        />
      )}
    </div>
  );
}
