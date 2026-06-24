"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";

interface TaskAssignment {
  id: string;
  title: string;
  description: string;
  assigned_by: string;
  assigned_by_name: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_to_email: string;
  task_priority: "high" | "medium" | "low";
  status: "assigned" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  due_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  related_record_id: string | null;
  related_record_type: string | null;
  attachments: any[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  comment_text: string;
  attachments: any[];
  created_at: string;
}

export default function TasksPage() {
  const user = useCurrentUser();
  const [assignedToMe, setAssignedToMe] = useState<TaskAssignment[]>([]);
  const [assignedByMe, setAssignedByMe] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskAssignment | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    assigned_to_name: "",
    assigned_to_email: "",
    task_priority: "medium",
    due_date: "",
    due_time: "",
  });

  useEffect(() => {
    loadTasks();
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [myTasks, createdTasks] = await Promise.all([
        fetch(`/api/tasks?assigned_to=${user.id}&limit=50`).then((r) =>
          r.json()
        ),
        fetch(`/api/tasks?assigned_by=${user.id}&limit=50`).then((r) =>
          r.json()
        ),
      ]);

      if (myTasks.success) {
        setAssignedToMe(myTasks.data || []);
      }
      if (createdTasks.success) {
        setAssignedByMe(createdTasks.data || []);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`);
      const result = await response.json();

      if (result.success) {
        setTaskComments(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load task comments:", err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.assigned_to) return;

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          assigned_by: user.id,
          assigned_by_name: user.full_name,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAssignedByMe([result.data, ...assignedByMe]);
        setFormData({
          title: "",
          description: "",
          assigned_to: "",
          assigned_to_name: "",
          assigned_to_email: "",
          task_priority: "medium",
          due_date: "",
          due_time: "",
        });
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    newStatus: "assigned" | "in_progress" | "completed" | "cancelled"
  ) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();
      if (result.success) {
        setAssignedToMe(
          assignedToMe.map((t) => (t.id === taskId ? result.data : t))
        );
        setAssignedByMe(
          assignedByMe.map((t) => (t.id === taskId ? result.data : t))
        );
        setSelectedTask(result.data);
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      setAssignedToMe(assignedToMe.filter((t) => t.id !== taskId));
      setAssignedByMe(assignedByMe.filter((t) => t.id !== taskId));
      setSelectedTask(null);
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !user || !commentText.trim()) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.full_name,
          comment_text: commentText,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setTaskComments([...taskComments, result.data]);
        setCommentText("");
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-orange-500";
      default:
        return "text-green-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
            In Progress
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
            Assigned
          </span>
        );
    }
  };

  const isOverdue = (task: TaskAssignment) => {
    if (!task.due_date || task.status === "completed") return false;
    return new Date(task.due_date) < new Date();
  };

  const filteredAssignedToMe = assignedToMe.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assigned_by_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssignedByMe = assignedByMe.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assigned_to_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title="✅ Tasks"
          subtitle="Manage and track task assignments"
        />

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text placeholder-aviva-secondary"
            />
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition flex items-center gap-2 font-semibold"
          >
            <Plus size={20} />
            New Task
          </button>
        </div>

        {showCreateForm && (
          <GlassCard className="mb-6">
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label htmlFor="taskform-title" className="block text-sm font-semibold text-aviva-text mb-2">
                  Task Title
                </label>
                <input
                  id="taskform-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                />
              </div>

              <div>
                <label htmlFor="taskform-description" className="block text-sm font-semibold text-aviva-text mb-2">
                  Description
                </label>
                <textarea
                  id="taskform-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taskform-assigned_to_email" className="block text-sm font-semibold text-aviva-text mb-2">
                    Assign To (Email)
                  </label>
                  <input
                    id="taskform-assigned_to_email"
                    type="email"
                    value={formData.assigned_to_email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        assigned_to_email: e.target.value,
                      })
                    }
                    required
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  />
                </div>

                <div>
                  <label htmlFor="taskform-priority" className="block text-sm font-semibold text-aviva-text mb-2">
                    Priority
                  </label>
                  <select
                    id="taskform-priority"
                    value={formData.task_priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        task_priority: e.target.value as "high" | "medium" | "low",
                      })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taskform-due_date" className="block text-sm font-semibold text-aviva-text mb-2">
                    Due Date
                  </label>
                  <input
                    id="taskform-due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  />
                </div>

                <div>
                  <label htmlFor="taskform-due_time" className="block text-sm font-semibold text-aviva-text mb-2">
                    Due Time
                  </label>
                  <input
                    id="taskform-due_time"
                    type="time"
                    value={formData.due_time}
                    onChange={(e) =>
                      setFormData({ ...formData, due_time: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition font-semibold"
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-aviva-secondary/20 text-aviva-secondary rounded-lg hover:bg-aviva-secondary/30 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        )}

        {loading ? (
          <p className="text-center text-aviva-secondary">Loading tasks...</p>
        ) : (
          <div className="space-y-8">
            {/* Tasks Assigned to Me */}
            <section>
              <h2 className="text-xl font-bold text-aviva-text mb-4 flex items-center gap-2">
                <AlertCircle size={24} className="text-aviva-gold" />
                Assigned to Me ({filteredAssignedToMe.length})
              </h2>

              {filteredAssignedToMe.length === 0 ? (
                <p className="text-center text-aviva-secondary py-8">
                  No tasks assigned to you
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAssignedToMe.map((task) => (
                    <GlassCard
                      key={task.id}
                      className={`cursor-pointer hover:border-aviva-gold/40 transition ${
                        isOverdue(task) ? "border-red-500/50" : ""
                      }`}
                      onClick={() => {
                        setSelectedTask(task);
                        loadTaskComments(task.id);
                      }}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-bold text-aviva-text flex-1">
                            {task.title}
                          </h3>
                          <span
                            className={`text-xs font-bold ${getPriorityColor(
                              task.task_priority
                            )}`}
                          >
                            {task.task_priority.toUpperCase()}
                          </span>
                        </div>

                        <p className="text-xs text-aviva-secondary">
                          From: {task.assigned_by_name}
                        </p>

                        {task.description && (
                          <p className="text-xs text-aviva-text/70 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          {getStatusBadge(task.status)}
                          {isOverdue(task) && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle size={12} />
                              Overdue
                            </span>
                          )}
                        </div>

                        {task.due_date && (
                          <p className="text-xs text-aviva-secondary flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(task.due_date).toLocaleDateString(
                              "th-TH"
                            )}
                          </p>
                        )}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </section>

            {/* Tasks Assigned by Me */}
            <section>
              <h2 className="text-xl font-bold text-aviva-text mb-4 flex items-center gap-2">
                <CheckCircle size={24} className="text-aviva-gold" />
                Assigned by Me ({filteredAssignedByMe.length})
              </h2>

              {filteredAssignedByMe.length === 0 ? (
                <p className="text-center text-aviva-secondary py-8">
                  You haven't assigned any tasks yet
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAssignedByMe.map((task) => (
                    <GlassCard
                      key={task.id}
                      className="cursor-pointer hover:border-aviva-gold/40 transition"
                      onClick={() => {
                        setSelectedTask(task);
                        loadTaskComments(task.id);
                      }}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-bold text-aviva-text flex-1">
                            {task.title}
                          </h3>
                          <span
                            className={`text-xs font-bold ${getPriorityColor(
                              task.task_priority
                            )}`}
                          >
                            {task.task_priority.toUpperCase()}
                          </span>
                        </div>

                        <p className="text-xs text-aviva-secondary">
                          To: {task.assigned_to_name}
                        </p>

                        {task.description && (
                          <p className="text-xs text-aviva-text/70 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          {getStatusBadge(task.status)}
                        </div>

                        {task.due_date && (
                          <p className="text-xs text-aviva-secondary flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(task.due_date).toLocaleDateString(
                              "th-TH"
                            )}
                          </p>
                        )}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedTask(null);
              setTaskComments([]);
              setCommentText("");
            }}
          >
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <GlassCard className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-aviva-text">
                      {selectedTask.title}
                    </h2>
                    <p className="text-sm text-aviva-secondary mt-1">
                      {selectedTask.assigned_by_name} →{" "}
                      {selectedTask.assigned_to_name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTask(null);
                      setTaskComments([]);
                    }}
                    className="text-aviva-secondary hover:text-aviva-text"
                  >
                    ✕
                  </button>
                </div>

                {/* Task Info */}
                <div className="space-y-4 mb-6 pb-6 border-b border-aviva-gold/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">
                        Status
                      </p>
                      <div className="flex gap-2">
                        {getStatusBadge(selectedTask.status)}
                        {selectedTask.status !== "completed" && (
                          <select
                            value={selectedTask.status}
                            onChange={(e) =>
                              handleUpdateTaskStatus(
                                selectedTask.id,
                                e.target.value as any
                              )
                            }
                            className="px-2 py-1 bg-aviva-bg/50 border border-aviva-gold/20 rounded text-xs text-aviva-text"
                          >
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">
                        Priority
                      </p>
                      <p className={`text-sm ${getPriorityColor(selectedTask.task_priority)}`}>
                        {selectedTask.task_priority.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {selectedTask.description && (
                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">
                        Description
                      </p>
                      <p className="text-sm text-aviva-text">
                        {selectedTask.description}
                      </p>
                    </div>
                  )}

                  {selectedTask.due_date && (
                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">
                        Due Date
                      </p>
                      <p className="text-sm text-aviva-text flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(selectedTask.due_date).toLocaleString(
                          "th-TH"
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-aviva-text mb-3">
                    Comments ({taskComments.length})
                  </h3>

                  <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto">
                    {taskComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-aviva-bg/30 p-3 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold text-aviva-text">
                            {comment.user_name}
                          </p>
                          <p className="text-xs text-aviva-secondary">
                            {new Date(comment.created_at).toLocaleTimeString(
                              "th-TH"
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-aviva-text/80">
                          {comment.comment_text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {selectedTask.status !== "cancelled" && (
                    <form
                      onSubmit={handleAddComment}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-xs text-aviva-text placeholder-aviva-secondary"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition"
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  )}
                </div>

                {/* Delete Button */}
                {(user?.isAdmin ||
                  user?.id === selectedTask.assigned_by) && (
                  <button
                    onClick={() => {
                      handleDeleteTask(selectedTask.id);
                    }}
                    className="w-full mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete Task
                  </button>
                )}
              </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
