import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../api/client';
import { Check, X, Send } from 'lucide-react';

const REASONS = [
  'Wrong answer',
  'Outdated',
  'Missing source',
  'Should not have had access',
  'Other',
];

export function FeedbackPanel({ messageId, threadId, messageIndex, onClose }) {
  const { showToast } = useAppStore();
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleReason = (reason) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter((r) => r !== reason));
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      await apiClient.submitFeedback({
        messageId,
        threadId,
        messageIndex,
        rating: 'down',
        reasons: selectedReasons,
        comment: comment.trim(),
      });
      showToast('Thank you for your feedback', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to submit feedback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2.5 p-3 rounded-card bg-surface border border-border text-xs animate-in fade-in-50 duration-150">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="font-semibold text-text">Provide feedback</span>
        <button onClick={onClose} className="p-1 text-muted hover:text-text rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-2.5 space-y-2.5">
        <div>
          <span className="text-[11px] text-faint font-mono block mb-1.5">
            What was the issue? (Select all that apply)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((reason) => {
              const isSelected = selectedReasons.includes(reason);
              return (
                <button
                  type="button"
                  key={reason}
                  onClick={() => toggleReason(reason)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-sans transition-colors border ${
                    isSelected
                      ? 'bg-primary/20 text-primary border-primary/40 font-medium'
                      : 'bg-elevated text-muted border-border hover:text-text hover:bg-hover'
                  }`}
                >
                  {reason}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional details (e.g. correct policy section)..."
            className="w-full bg-elevated border border-border rounded-control p-2 text-xs text-text placeholder-faint focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-control text-xs text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary-gradient px-3 py-1 rounded-control text-xs font-medium flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            <span>Submit</span>
          </button>
        </div>
      </form>
    </div>
  );
}
