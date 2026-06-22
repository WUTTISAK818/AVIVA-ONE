"use client";

import { useState, useEffect } from "react";
import { Plus, Target } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import MilestoneTracker from "@/components/MilestoneTracker";

export default function GoalsPage() {
  const user = useCurrentUser();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    department: "",
    activity_type: "construction",
    category: "",
    target_count: 10,
    period: "weekly",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/activity/goals`);
      const result = await response.json();

      if (result.success) {
        setGoals(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/activity/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          created_by: user?.id,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGoals([result.data, ...goals]);
        setFormData({
          department: "",
          activity_type: "construction",
          category: "",
          target_count: 10,
          period: "weekly",
          start_date: "",
          end_date: "",
        });
        setShowForm(false);
      }
    } catch (err) {
      console.error("Failed to create goal:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          title="🎯 Goals & Milestones"
          subtitle="Set and track department and team goals"
        />

        {(user?.isAdmin || user?.isManager) && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-6 px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition flex items-center gap-2 font-semibold"
          >
            <Plus size={20} />
            New Goal
          </button>
        )}

        {showForm && (user?.isAdmin || user?.isManager) && (
          <GlassCard className="mb-6">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-aviva-text mb-2">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  >
                    <option value="">Select Department</option>
                    <option value="construction">Construction</option>
                    <option value="sales">Sales</option>
                    <option value="finance">Finance</option>
                    <option value="hr">HR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-aviva-text mb-2">
                    Activity Type
                  </label>
                  <select
                    value={formData.activity_type}
                    onChange={(e) =>
                      setFormData({ ...formData, activity_type: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  >
                    <option value="construction">Construction</option>
                    <option value="sales">Sales</option>
                    <option value="finance">Finance</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-aviva-text mb-2">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g., Lead Generation, House Updates"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-aviva-text mb-2">
                    Target Count
                  </label>
                  <input
                    type="number"
                    value={formData.target_count}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_count: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-aviva-text mb-2">
                    Period
                  </label>
                  <select
                    value={formData.period}
                    onChange={(e) =>
                      setFormData({ ...formData, period: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-aviva-text mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-aviva-text mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition font-semibold"
                >
                  Create Goal
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-aviva-secondary/20 text-aviva-secondary rounded-lg hover:bg-aviva-secondary/30 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        )}

        {/* Goals List */}
        <MilestoneTracker goals={goals} loading={loading} />
      </div>
    </div>
  );
}
