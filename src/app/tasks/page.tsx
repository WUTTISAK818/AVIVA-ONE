"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus, CheckCircle, Clock, AlertCircle, XCircle, Edit2, ThumbsUp, ThumbsDown } from "lucide-react";
import type { ComponentType } from "react";
import { useCurrentUser } from "@/lib/user-context";
import type { Task, TaskStatus, TaskPriority } from "@/lib/task-types";

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: any; bgColor: string }> = {
  pending: { label: "รอดำเนิน", color: "text-gray-600", icon: Clock, bgColor: "bg-gray-100" },
  in_progress: { label: "กำลังทำ", color: "text-blue-600", icon: Clock, bgColor: "bg-blue-100" },
  completed: { label: "เสร็จแล้ว", color: "text-green-600", icon: CheckCircle, bgColor: "bg-green-100" },
  approved: { label: "อนุมัติแล้ว", color: "text-emerald-600", icon: CheckCircle, bgColor: "bg-emerald-100" },
  rejected: { label: "ปฏิเสธ", color: "text-red-600", icon: XCircle, bgColor: "bg-red-100" },
};

type PriorityConfig = Record<TaskPriority, { label: string; color: string }>;
const priorityConfig: PriorityConfig = {
  low: { label: "ต่ำ", color: "text-gray-500" },
  medium: { label: "กลาง", color: "text-yellow-600" },
  high: { label: "สูง", color: "text-orange-600" },
  critical: { label: "วิกฤต", color: "text-red-600" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: TaskStatus; priority?: TaskPriority }>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const user = useCurrentUser();

  const isManager = user?.role && ["admin", "ceo", "coo", "manager", "director"].includes(user.role);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.status) params.append("status", filter.status);
      if (filter.priority) params.append("priority", filter.priority);

      const response = await fetch(`/api/tasks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");

      const data = await response.json();
      setTasks(data.data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!response.ok) throw new Error("Failed to approve");

      fetchTasks();
      setExpandedTask(null);
    } catch (error) {
      console.error("Error approving task:", error);
      alert("เกิดข้อผิดพลาดในการอนุมัติ");
    }
  };

  const handleReject = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      fetchTasks();
      setExpandedTask(null);
    } catch (error) {
      console.error("Error rejecting task:", error);
      alert("เกิดข้อผิดพลาดในการปฏิเสธ");
    }
  };

  const handleUpdateProgress = async (taskId: string, progressPct: number, status: TaskStatus) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress_pct: progressPct,
          status: status,
          ...(status === "completed" && { completed_date: new Date().toISOString() }),
          ...(status === "in_progress" && { started_date: new Date().toISOString() }),
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter.status && task.status !== filter.status) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    return true;
  });

  const statsCount = {
    pending: tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    approved: tasks.filter(t => t.status === "approved").length,
    rejected: tasks.filter(t => t.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-aviva-bg via-aviva-bg/95 to-aviva-bg/90 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-aviva-text">📋 Task Management</h1>
            <p className="text-aviva-secondary mt-1">ติดตามงานและฟีเจอร์ที่ได้สั่งพัฒนา</p>
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-aviva-gold/90 transition-all font-semibold"
            >
              <Plus size={18} />
              สร้างงานใหม่
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "รอดำเนิน", count: statsCount.pending, status: "pending" as TaskStatus },
            { label: "กำลังทำ", count: statsCount.in_progress, status: "in_progress" as TaskStatus },
            { label: "เสร็จแล้ว", count: statsCount.completed, status: "completed" as TaskStatus },
            { label: "อนุมัติแล้ว", count: statsCount.approved, status: "approved" as TaskStatus },
            { label: "ปฏิเสธ", count: statsCount.rejected, status: "rejected" as TaskStatus },
          ].map((stat) => {
            const config = statusConfig[stat.status];
            const Icon = config.icon;
            return (
              <button
                key={stat.status}
                onClick={() => setFilter({ ...filter, status: stat.status })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  filter.status === stat.status
                    ? `border-aviva-gold bg-aviva-gold/10`
                    : `border-aviva-gold/20 bg-aviva-card hover:border-aviva-gold/50`
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={config.color} />
                  <span className="text-[11px] font-semibold text-aviva-secondary">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-aviva-text">{stat.count}</p>
              </button>
            );
          })}
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-aviva-secondary">กำลังโหลดงาน...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-aviva-card rounded-lg border border-aviva-gold/10">
              <p className="text-aviva-secondary">ไม่พบงานที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const taskStatusConfig = statusConfig[task.status];
              const taskPriorityConfig = priorityConfig[task.priority];
              const StatusIcon = taskStatusConfig.icon;
              const isExpanded = expandedTask === task.id;

              return (
                <div
                  key={task.id}
                  className={`bg-aviva-card rounded-lg border transition-all ${
                    isExpanded ? "border-aviva-gold/50 shadow-lg" : "border-aviva-gold/10 hover:border-aviva-gold/30"
                  }`}
                >
                  {/* Task Header */}
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-aviva-bg/50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${taskStatusConfig.bgColor}`}>
                      <StatusIcon size={18} className={taskStatusConfig.color} />
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <h3 className="font-semibold text-aviva-text truncate">{task.title}</h3>
                      <p className="text-sm text-aviva-secondary/70 line-clamp-1">{task.description}</p>
                    </div>

                    <div className="hidden sm:flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${taskPriorityConfig.color} bg-aviva-bg`}>
                        {taskPriorityConfig.label}
                      </span>
                      <div className="w-24 bg-aviva-bg rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-aviva-gold to-aviva-gold h-2 rounded-full transition-all"
                          style={{ width: `${task.progress_pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-aviva-secondary w-8 text-right">{task.progress_pct}%</span>
                    </div>

                    <ChevronDown
                      size={20}
                      className={`text-aviva-secondary/50 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Task Details */}
                  {isExpanded && (
                    <div className="border-t border-aviva-gold/10 p-4 space-y-4">
                      {/* Description */}
                      {task.description && (
                        <div>
                          <p className="text-xs font-semibold text-aviva-gold uppercase mb-2">รายละเอียด</p>
                          <p className="text-sm text-aviva-text bg-aviva-bg/50 p-3 rounded">{task.description}</p>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-[10px] text-aviva-secondary uppercase font-bold mb-1">สั่งวันที่</p>
                          <p className="text-sm font-semibold text-aviva-text">
                            {new Date(task.created_at).toLocaleDateString("th-TH")}
                          </p>
                        </div>
                        {task.due_date && (
                          <div>
                            <p className="text-[10px] text-aviva-secondary uppercase font-bold mb-1">ครบกำหนด</p>
                            <p className="text-sm font-semibold text-aviva-text">
                              {new Date(task.due_date).toLocaleDateString("th-TH")}
                            </p>
                          </div>
                        )}
                        {task.completed_date && (
                          <div>
                            <p className="text-[10px] text-aviva-secondary uppercase font-bold mb-1">เสร็จวันที่</p>
                            <p className="text-sm font-semibold text-aviva-text">
                              {new Date(task.completed_date).toLocaleDateString("th-TH")}
                            </p>
                          </div>
                        )}
                        {task.estimated_hours && (
                          <div>
                            <p className="text-[10px] text-aviva-secondary uppercase font-bold mb-1">ประมาณการ</p>
                            <p className="text-sm font-semibold text-aviva-text">{task.estimated_hours} ชม.</p>
                          </div>
                        )}
                      </div>

                      {/* Progress & Notes */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-aviva-gold uppercase">ความสำเร็จ</p>
                            <p className="text-sm font-bold text-aviva-text">{task.progress_pct}%</p>
                          </div>
                          <div className="w-full bg-aviva-bg rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-aviva-gold to-aviva-gold/70 h-3 rounded-full transition-all"
                              style={{ width: `${task.progress_pct}%` }}
                            />
                          </div>
                        </div>

                        {task.developer_notes && (
                          <div>
                            <p className="text-xs font-semibold text-aviva-secondary mb-1">💬 หมายเหตุจากนักพัฒนา</p>
                            <p className="text-sm text-aviva-text bg-aviva-bg/50 p-2 rounded">{task.developer_notes}</p>
                          </div>
                        )}

                        {task.manager_notes && (
                          <div>
                            <p className="text-xs font-semibold text-aviva-gold mb-1">👨‍💼 หมายเหตุจากผู้บริหาร</p>
                            <p className="text-sm text-aviva-text bg-aviva-bg/50 p-2 rounded">{task.manager_notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-aviva-gold/10">
                        {task.status === "in_progress" && (
                          <button
                            onClick={() => handleUpdateProgress(task.id, 100, "completed")}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-600 rounded hover:bg-green-500/30 transition-all text-sm font-semibold"
                          >
                            <CheckCircle size={14} />
                            ทำเสร็จแล้ว
                          </button>
                        )}

                        {task.status === "pending" && (
                          <button
                            onClick={() => handleUpdateProgress(task.id, 10, "in_progress")}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-600 rounded hover:bg-blue-500/30 transition-all text-sm font-semibold"
                          >
                            <Clock size={14} />
                            เริ่มทำ
                          </button>
                        )}

                        {isManager && task.status === "completed" && (
                          <>
                            <button
                              onClick={() => handleApprove(task.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-600 rounded hover:bg-emerald-500/30 transition-all text-sm font-semibold"
                            >
                              <ThumbsUp size={14} />
                              อนุมัติ
                            </button>
                            <button
                              onClick={() => handleReject(task.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-600 rounded hover:bg-red-500/30 transition-all text-sm font-semibold"
                            >
                              <ThumbsDown size={14} />
                              ปฏิเสธ
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
