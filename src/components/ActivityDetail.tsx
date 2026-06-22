"use client";

import { useState } from "react";
import { Send, X, MessageCircle, Clock, User } from "lucide-react";
import GlassCard from "./GlassCard";

interface Comment {
  id: string;
  user_name: string;
  comment_text: string;
  created_at: string;
}

interface ActivityDetailProps {
  activity: any;
  comments: Comment[];
  onClose: () => void;
  onAddComment: (text: string) => Promise<void>;
  loading?: boolean;
}

export default function ActivityDetail({
  activity,
  comments,
  onClose,
  onAddComment,
  loading,
}: ActivityDetailProps) {
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      await onAddComment(commentText);
      setCommentText("");
    } finally {
      setSubmitting(false);
    }
  };

  const typeEmoji: Record<string, string> = {
    construction: "🔴",
    finance: "🟠",
    hr: "🟢",
    sales: "💰",
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <GlassCard className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{typeEmoji[activity?.activity_type]}</span>
                  <h2 className="text-2xl font-bold text-aviva-text capitalize">
                    {activity?.activity_type}
                  </h2>
                </div>
                <p className="text-sm text-aviva-secondary">
                  {activity?.performer_name} • {activity?.performer_department}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-aviva-secondary hover:text-aviva-text transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Activity Details */}
            <div className="space-y-3 mb-6 pb-6 border-b border-aviva-gold/20">
              <div>
                <p className="text-xs text-aviva-secondary mb-1">Category</p>
                <p className="text-sm text-aviva-text">{activity?.category || "N/A"}</p>
              </div>

              <div>
                <p className="text-xs text-aviva-secondary mb-1">Description</p>
                <p className="text-sm text-aviva-text">{activity?.description || "N/A"}</p>
              </div>

              {activity?.quantity && (
                <div>
                  <p className="text-xs text-aviva-secondary mb-1">Quantity</p>
                  <p className="text-sm text-aviva-text">{activity.quantity}</p>
                </div>
              )}

              {activity?.amount && (
                <div>
                  <p className="text-xs text-aviva-secondary mb-1">Amount</p>
                  <p className="text-sm text-aviva-text">
                    ฿{activity.amount.toLocaleString()}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-aviva-secondary">
                <Clock size={14} />
                {new Date(activity?.created_at).toLocaleString("th-TH")}
              </div>

              {activity?.reference_id && (
                <div>
                  <a
                    href={activity.reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-aviva-gold hover:underline"
                  >
                    View Original Record →
                  </a>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div>
              <h3 className="text-sm font-bold text-aviva-text mb-3 flex items-center gap-2">
                <MessageCircle size={16} className="text-aviva-gold" />
                Comments ({comments.length})
              </h3>

              <div className="space-y-2 mb-4 max-h-[250px] overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-aviva-bg/30 p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-semibold text-aviva-text flex items-center gap-1">
                        <User size={12} />
                        {comment.user_name}
                      </p>
                      <p className="text-xs text-aviva-secondary">
                        {new Date(comment.created_at).toLocaleTimeString("th-TH")}
                      </p>
                    </div>
                    <p className="text-xs text-aviva-text/80">{comment.comment_text}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-xs text-aviva-secondary/50 py-4 text-center">
                    No comments yet
                  </p>
                )}
              </div>

              {/* Comment Form */}
              <form onSubmit={handleSubmit} className="space-y-2">
                <textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-xs text-aviva-text placeholder-aviva-secondary"
                />
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="w-full px-3 py-2 bg-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/30 transition rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Send size={12} />
                  Comment
                </button>
              </form>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
