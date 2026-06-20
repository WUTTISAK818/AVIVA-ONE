"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Plus, Send, CheckCircle, Clock } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";

interface Answer {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

interface Question {
  id: string;
  report_id: string;
  question_by_id: string;
  question_by_name: string;
  question_by_role: string;
  question_text: string;
  answers: Answer[];
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface ReportQASectionProps {
  reportId: string;
  reportDate: string;
  reportAuthorId: string;
  reportAuthorName: string;
  reportAuthorEmail: string;
}

export default function ReportQASection({
  reportId,
  reportDate,
  reportAuthorId,
  reportAuthorName,
  reportAuthorEmail,
}: ReportQASectionProps) {
  const user = useCurrentUser();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAskForm, setShowAskForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [reportId]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/${reportId}/questions`);
      const result = await response.json();

      if (result.success) {
        setQuestions(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !questionText.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/reports/${reportId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_date: reportDate,
          report_author_id: reportAuthorId,
          report_author_name: reportAuthorName,
          report_author_email: reportAuthorEmail,
          question_by_id: user.id,
          question_by_name: user.full_name,
          question_by_role: user.role,
          question_text: questionText,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setQuestions([result.data, ...questions]);
        setQuestionText("");
        setShowAskForm(false);
      }
    } catch (err) {
      console.error("Failed to ask question:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnswer = async (questionId: string) => {
    if (!user || !answerText.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/reports/questions/${questionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            user_name: user.full_name,
            answer_text: answerText,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setQuestions(
          questions.map((q) => (q.id === questionId ? result.data : q))
        );
        setAnswerText("");
      }
    } catch (err) {
      console.error("Failed to add answer:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveQuestion = async (questionId: string, isResolved: boolean) => {
    try {
      const response = await fetch(
        `/api/reports/questions/${questionId}/answer`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_resolved: !isResolved }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setQuestions(
          questions.map((q) => (q.id === questionId ? result.data : q))
        );
      }
    } catch (err) {
      console.error("Failed to update question:", err);
    }
  };

  const canAskQuestion = user?.isManager || user?.isAdmin;
  const unreadCount = questions.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-aviva-text flex items-center gap-2">
          <MessageCircle size={18} className="text-aviva-gold" />
          Questions & Answers
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>

        {canAskQuestion && !showAskForm && (
          <button
            onClick={() => setShowAskForm(true)}
            className="px-3 py-1 bg-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/30 transition rounded-lg flex items-center gap-1 text-xs font-semibold"
          >
            <Plus size={14} />
            Ask
          </button>
        )}
      </div>

      {showAskForm && (
        <GlassCard>
          <form onSubmit={handleAskQuestion} className="p-4 space-y-3">
            <textarea
              placeholder="Ask a question about this report..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-sm text-aviva-text placeholder-aviva-secondary"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-3 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition text-sm font-semibold disabled:opacity-50"
              >
                Ask Question
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAskForm(false);
                  setQuestionText("");
                }}
                className="flex-1 px-3 py-2 bg-aviva-secondary/20 text-aviva-secondary rounded-lg hover:bg-aviva-secondary/30 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <p className="text-center text-aviva-secondary text-sm">Loading Q&A...</p>
      ) : questions.length === 0 ? (
        <p className="text-center text-aviva-secondary text-sm py-4">
          No questions yet
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <GlassCard key={question.id}>
              <div className="p-4 space-y-3">
                {/* Question Header */}
                <div
                  className="cursor-pointer space-y-2"
                  onClick={() =>
                    setExpandedQuestion(
                      expandedQuestion === question.id ? null : question.id
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-aviva-secondary mb-1">
                        {question.question_by_name} ({question.question_by_role})
                      </p>
                      <p className="text-sm text-aviva-text">
                        {question.question_text}
                      </p>
                    </div>
                    {question.is_resolved ? (
                      <CheckCircle
                        size={18}
                        className="text-green-500 flex-shrink-0"
                      />
                    ) : (
                      <Clock
                        size={18}
                        className="text-yellow-500 flex-shrink-0"
                      />
                    )}
                  </div>

                  <p className="text-xs text-aviva-secondary">
                    {new Date(question.created_at).toLocaleDateString("th-TH")}{" "}
                    {new Date(question.created_at).toLocaleTimeString("th-TH")}
                  </p>
                </div>

                {/* Expanded Content */}
                {expandedQuestion === question.id && (
                  <div className="border-t border-aviva-gold/20 pt-3 space-y-3">
                    {/* Answers */}
                    {question.answers && question.answers.length > 0 && (
                      <div className="space-y-2 bg-aviva-bg/30 p-3 rounded-lg">
                        <p className="text-xs font-semibold text-aviva-text">
                          Answers ({question.answers.length})
                        </p>
                        {question.answers.map((answer) => (
                          <div
                            key={answer.id}
                            className="bg-aviva-bg/50 p-2 rounded border border-aviva-gold/10"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-xs font-semibold text-aviva-text">
                                {answer.user_name}
                              </p>
                              <p className="text-xs text-aviva-secondary">
                                {new Date(answer.created_at).toLocaleTimeString(
                                  "th-TH"
                                )}
                              </p>
                            </div>
                            <p className="text-xs text-aviva-text/80">
                              {answer.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Answer Form */}
                    {!question.is_resolved && (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Type your answer..."
                          value={
                            expandedQuestion === question.id ? answerText : ""
                          }
                          onChange={(e) => setAnswerText(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-xs text-aviva-text placeholder-aviva-secondary"
                        />
                        <button
                          onClick={() => handleAddAnswer(question.id)}
                          disabled={submitting || !answerText.trim()}
                          className="w-full px-3 py-2 bg-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/30 transition rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Send size={12} />
                          Reply
                        </button>
                      </div>
                    )}

                    {/* Mark as Resolved */}
                    {(user?.id === question.question_by_id ||
                      user?.id === reportAuthorId) && (
                      <button
                        onClick={() =>
                          handleResolveQuestion(
                            question.id,
                            question.is_resolved
                          )
                        }
                        className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          question.is_resolved
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-aviva-secondary/20 text-aviva-secondary hover:bg-aviva-secondary/30"
                        }`}
                      >
                        {question.is_resolved
                          ? "✓ Resolved"
                          : "Mark as Resolved"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
