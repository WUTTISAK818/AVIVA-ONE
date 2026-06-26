import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    // Verify request is from cron job or authorized source
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log(`[Notifications] Running scheduled job at ${now.toISOString()}`);

    // Get all active notification rules
    const { data: rules, error: rulesError } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) throw rulesError;

    let sentCount = 0;

    for (const rule of rules || []) {
      let shouldTrigger = false;

      if (rule.event_type === "daily") {
        const [ruleHour, ruleMinute] = (rule.trigger_time || "06:00").split(":");
        if (parseInt(ruleHour) === currentHour && parseInt(ruleMinute) === currentMinute) {
          shouldTrigger = true;
        }
      }

      if (!shouldTrigger) continue;

      // Get user count for notification
      const { count } = await supabase
        .from("auth.users")
        .select("id", { count: "exact" })
        .limit(1);

      // Send notification to admins
      const { data: admins } = await supabase
        .from("auth.users")
        .select("id, email")
        .in("role", rule.recipients_role || ["admin", "ceo", "coo"]);

      for (const admin of admins || []) {
        await supabase.from("notifications_sent").insert([
          {
            rule_id: rule.id,
            recipient_id: admin.id,
            recipient_email: admin.email,
            title: rule.title_template,
            message: rule.message_template,
            channels_sent: [
              rule.send_to_app && "app",
              rule.send_to_line && "line",
              rule.send_to_email && "email",
            ].filter(Boolean),
          },
        ]);
        sentCount++;
      }
    }

    console.log(`[Notifications] Sent ${sentCount} notifications`);
    return NextResponse.json({ success: true, sentCount });
  } catch (error) {
    console.error("[Notifications] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
