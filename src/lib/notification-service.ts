import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export interface NotificationRule {
  id: string;
  name: string;
  event_type: "daily" | "time_based" | "task_based" | "deadline";
  trigger_time?: string;
  recipients_role: string[];
  recipients_department: string[];
  title_template: string;
  message_template: string;
  send_to_app: boolean;
  send_to_line: boolean;
  send_to_email: boolean;
  priority: "low" | "medium" | "high" | "critical";
  is_active: boolean;
}

export async function sendNotification(
  recipientId: string,
  title: string,
  message: string,
  channels: ("app" | "line" | "email")[] = ["app"],
  actionUrl?: string
) {
  try {
    const { data, error } = await supabase.from("notifications_sent").insert([
      {
        recipient_id: recipientId,
        title,
        message,
        channels_sent: channels,
        action_url: actionUrl,
      },
    ]);

    if (error) throw error;

    // Send via LINE if needed
    if (channels.includes("line")) {
      await sendLineNotification(recipientId, title, message);
    }

    return { success: true, data };
  } catch (error) {
    console.error("[NotificationService] Error sending notification:", error);
    return { success: false, error };
  }
}

export async function sendLineNotification(
  recipientId: string,
  title: string,
  message: string
) {
  try {
    // Get user LINE token from user metadata or LINE table
    const response = await fetch("/api/notify/personal-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: recipientId,
        title,
        message,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error("[NotificationService] Error sending LINE:", error);
    return { success: false, error };
  }
}

export async function getNotificationRules() {
  try {
    const { data, error } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[NotificationService] Error fetching rules:", error);
    return [];
  }
}

export async function getUserNotifications(userId: string, limit = 20) {
  try {
    const { data, error } = await supabase
      .from("notifications_sent")
      .select("*")
      .eq("recipient_id", userId)
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[NotificationService] Error fetching notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { data, error } = await supabase
      .from("notifications_sent")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[NotificationService] Error marking as read:", error);
    return { success: false, error };
  }
}
