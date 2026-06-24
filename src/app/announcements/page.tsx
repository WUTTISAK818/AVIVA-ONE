"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Search,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";

interface Announcement {
  id: string;
  title: string;
  content: string;
  announcement_type: string;
  priority: "high" | "medium" | "low";
  announced_by: string;
  announced_by_name: string;
  announced_by_role: string;
  target_roles: string[];
  target_departments: string[];
  target_user_ids: string[];
  attachments: any[];
  read_by: Record<string, string>;
  read_count: number;
  published_at: string;
  expires_at: string | null;
  is_archived: boolean;
  created_at: string;
}

export default function AnnouncementsPage() {
  const user = useCurrentUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    announcement_type: "info",
    priority: "medium",
    target_roles: [] as string[],
    target_departments: [] as string[],
    target_user_ids: [] as string[],
    expires_at: "",
  });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/announcements?limit=50&offset=0&include_archived=false`
      );
      const result = await response.json();

      if (result.success) {
        setAnnouncements(result.data || []);
        markAnnouncementsAsRead(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAnnouncementsAsRead = async (items: Announcement[]) => {
    if (!user) return;

    for (const announcement of items) {
      if (!announcement.read_by?.[user.id]) {
        try {
          await supabase
            .from("announcements")
            .update({
              read_by: {
                ...announcement.read_by,
                [user.id]: new Date().toISOString(),
              },
              read_count: (announcement.read_count || 0) + 1,
            })
            .eq("id", announcement.id);
        } catch (err) {
          console.error("Failed to mark announcement as read:", err);
        }
      }
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          announced_by: user.id,
          announced_by_name: user.full_name,
          announced_by_role: user.role,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAnnouncements([result.data, ...announcements]);
        setFormData({
          title: "",
          content: "",
          announcement_type: "info",
          priority: "medium",
          target_roles: [],
          target_departments: [],
          target_user_ids: [],
          expires_at: "",
        });
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error("Failed to create announcement:", err);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await supabase
        .from("announcements")
        .update({ is_archived: true })
        .eq("id", id);

      setAnnouncements(announcements.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete announcement:", err);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <span className="text-red-500">🔴 Urgent</span>;
      case "medium":
        return <span className="text-orange-500">🟠 High</span>;
      default:
        return <span className="text-green-500">🟢 Info</span>;
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredAnnouncements = announcements.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          title="📢 Announcements"
          subtitle="Organization-wide announcements and important updates"
        />

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text placeholder-aviva-secondary"
            />
          </div>
          {(user?.isAdmin || user?.isManager) && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition flex items-center gap-2 font-semibold"
            >
              <Plus size={20} />
              New Announcement
            </button>
          )}
        </div>

        {showCreateForm && (user?.isAdmin || user?.isManager) && (
          <GlassCard className="mb-6">
            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4">
              <div>
                <label htmlFor="announcementform-title" className="block text-sm font-semibold text-aviva-text mb-2">
                  Title
                </label>
                <input
                  id="announcementform-title"
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
                <label htmlFor="announcementform-content" className="block text-sm font-semibold text-aviva-text mb-2">
                  Content
                </label>
                <textarea
                  id="announcementform-content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  required
                  rows={5}
                  className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="announcementform-priority" className="block text-sm font-semibold text-aviva-text mb-2">
                    Priority
                  </label>
                  <select
                    id="announcementform-priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as "high" | "medium" | "low",
                      })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="announcementform-type" className="block text-sm font-semibold text-aviva-text mb-2">
                    Type
                  </label>
                  <select
                    id="announcementform-type"
                    value={formData.announcement_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        announcement_type: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="alert">Alert</option>
                    <option value="policy">Policy</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="announcementform-expires_at" className="block text-sm font-semibold text-aviva-text mb-2">
                  Expires At (Optional)
                </label>
                <input
                  id="announcementform-expires_at"
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) =>
                    setFormData({ ...formData, expires_at: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition font-semibold"
                >
                  Publish Announcement
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
          <p className="text-center text-aviva-secondary">Loading announcements...</p>
        ) : filteredAnnouncements.length === 0 ? (
          <p className="text-center text-aviva-secondary">No announcements found</p>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => (
              <GlassCard
                key={announcement.id}
                className="cursor-pointer hover:border-aviva-gold/40 transition"
                onClick={() => setSelectedAnnouncement(announcement)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-aviva-text mb-2">
                        {announcement.title}
                      </h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-aviva-secondary">
                          By {announcement.announced_by_name}
                        </span>
                        <span>{getPriorityBadge(announcement.priority)}</span>
                        {isExpired(announcement.expires_at) && (
                          <span className="text-xs text-red-500">Expired</span>
                        )}
                      </div>
                    </div>

                    {(user?.isAdmin || user?.isManager) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnnouncement(announcement.id);
                        }}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition"
                      >
                        <Trash2 size={18} className="text-red-500" />
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-aviva-text/80 line-clamp-2 mb-3">
                    {announcement.content}
                  </p>

                  <div className="flex items-center justify-between text-xs text-aviva-secondary">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {announcement.read_count} read
                      </span>
                      <span>
                        {new Date(announcement.published_at).toLocaleDateString(
                          "th-TH"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {selectedAnnouncement && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <GlassCard className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-aviva-text flex-1">
                    {selectedAnnouncement.title}
                  </h2>
                  <button
                    onClick={() => setSelectedAnnouncement(null)}
                    className="text-aviva-secondary hover:text-aviva-text"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <p className="text-xs text-aviva-secondary mb-1">By</p>
                    <p className="text-sm text-aviva-text">
                      {selectedAnnouncement.announced_by_name} ({selectedAnnouncement.announced_by_role})
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">Priority</p>
                      <p className="text-sm">
                        {getPriorityBadge(selectedAnnouncement.priority)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">Type</p>
                      <p className="text-sm text-aviva-text capitalize">
                        {selectedAnnouncement.announcement_type}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-aviva-secondary mb-1">Read Count</p>
                      <p className="text-sm text-aviva-text">
                        {selectedAnnouncement.read_count}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-aviva-gold/20 pb-6 mb-6">
                  <p className="text-sm text-aviva-text whitespace-pre-wrap">
                    {selectedAnnouncement.content}
                  </p>
                </div>

                <div className="text-xs text-aviva-secondary">
                  Published: {new Date(selectedAnnouncement.published_at).toLocaleString("th-TH")}
                  {selectedAnnouncement.expires_at && (
                    <>
                      <br />
                      Expires: {new Date(selectedAnnouncement.expires_at).toLocaleString("th-TH")}
                    </>
                  )}
                </div>
              </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
