'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/user-context';
import { Task } from '@/lib/task-types';

export default function CommandsPage() {
  const user = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchCommands();
  }, []);

  const fetchCommands = async () => {
    try {
      const res = await fetch('/api/tasks?type=commands');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch commands:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-purple-100 text-purple-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '⏳ รอดำเนินการ',
      in_progress: '🔄 กำลังทำ',
      completed: '✅ เสร็จแล้ว',
      approved: '✔️ อนุมัติแล้ว',
      rejected: '❌ ปฏิเสธ',
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      feature: '✨ ฟีเจอร์ใหม่',
      bugfix: '🐛 แก้ไขข้อบกพร่อง',
      enhancement: '⬆️ ปรับปรุง',
      refactor: '♻️ ปรับโครงสร้าง',
      other: '🔧 อื่น ๆ',
    };
    return labels[type || 'feature'] || 'ไม่ระบุ';
  };

  const filteredTasks = tasks.filter((task) => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const typeMatch = filterType === 'all' || task.command_type === filterType;
    return statusMatch && typeMatch;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed' || t.status === 'approved').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    deployed: tasks.filter((t) => t.deployed_date).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📋 ติดตามคำสั่ง</h1>
          <p className="text-lg text-slate-600">ระบบติดตามการพัฒนาฟีเจอร์และแก้ไขข้อบกพร่องของ AVIVA ONE</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-slate-500">
            <div className="text-sm text-gray-600">รวมทั้งหมด</div>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-600">เสร็จแล้ว</div>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-600">กำลังทำ</div>
            <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
            <div className="text-sm text-gray-600">รอดำเนินการ</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
            <div className="text-sm text-gray-600">Deploy แล้ว</div>
            <div className="text-3xl font-bold text-purple-600">{stats.deployed}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6 flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">สถานะ</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="in_progress">กำลังทำ</option>
              <option value="completed">เสร็จแล้ว</option>
              <option value="approved">อนุมัติแล้ว</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">ประเภท</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="feature">ฟีเจอร์ใหม่</option>
              <option value="bugfix">แก้ไขข้อบกพร่อง</option>
              <option value="enhancement">ปรับปรุง</option>
              <option value="refactor">ปรับโครงสร้าง</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-500">กำลังโหลด...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-500">ไม่พบคำสั่งที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                        {getTypeLabel(task.command_type)}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{task.title}</h3>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">ขอเมื่อ:</span>
                        <div>
                          {new Date(task.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      {task.started_date && (
                        <div>
                          <span className="font-medium">เริ่มทำ:</span>
                          <div>
                            {new Date(task.started_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      )}

                      {task.completed_date && (
                        <div>
                          <span className="font-medium">เสร็จ:</span>
                          <div>
                            {new Date(task.completed_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      )}

                      {task.deploy_version && (
                        <div className="bg-purple-50 p-2 rounded">
                          <span className="font-medium">Deploy:</span>
                          <div className="text-purple-700 font-semibold">{task.deploy_version}</div>
                        </div>
                      )}
                    </div>

                    {task.progress_pct > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-600">ความคืบหน้า</span>
                          <span className="text-xs font-semibold text-gray-700">
                            {task.progress_pct}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${task.progress_pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {task.related_commits && task.related_commits.length > 0 && (
                      <div className="mt-3 text-xs">
                        <span className="font-medium text-gray-600">Commits: </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {task.related_commits.map((commit) => (
                            <span
                              key={commit}
                              className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-xs"
                            >
                              {commit.substring(0, 7)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {task.developer_notes && (
                      <div className="mt-3 text-xs bg-blue-50 p-2 rounded">
                        <span className="font-medium text-blue-900">หมายเหตุ: </span>
                        <span className="text-blue-800">{task.developer_notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-center">
                    {task.status === 'completed' || task.status === 'approved' ? (
                      <div className="text-4xl">✅</div>
                    ) : task.status === 'in_progress' ? (
                      <div className="text-4xl animate-pulse">⚙️</div>
                    ) : task.status === 'pending' ? (
                      <div className="text-4xl">⏳</div>
                    ) : (
                      <div className="text-4xl">❌</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {filteredTasks.length > 0 && (
          <div className="mt-8 bg-blue-50 rounded-lg p-4 text-sm text-blue-900 border border-blue-200">
            <strong>สรุป:</strong> แสดง {filteredTasks.length} จาก {tasks.length} คำสั่ง •
            เสร็จแล้ว {stats.completed} • กำลังทำ {stats.inProgress} • รอดำเนินการ {stats.pending} • Deploy แล้ว{' '}
            {stats.deployed}
          </div>
        )}
      </div>
    </div>
  );
}
