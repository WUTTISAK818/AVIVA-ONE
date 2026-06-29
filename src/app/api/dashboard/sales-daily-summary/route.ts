import { supabase } from '@/lib/supabase';

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // ดึง sales_daily_logs ของวันนี้
    const { data: salesLogs, error: salesError } = await supabase
      .from('sales_daily_logs')
      .select('*')
      .eq('log_date', today)
      .eq('project_id', PROJECT_ID);

    if (salesError) throw salesError;

    // รวม activities ทั้งหมด
    const totalCalls = (salesLogs || []).reduce((sum, log) => sum + (log.activities_calls || 0), 0);
    const totalVisits = (salesLogs || []).reduce((sum, log) => sum + (log.activities_visits || 0), 0);
    const totalMeetings = (salesLogs || []).reduce((sum, log) => sum + (log.activities_meetings || 0), 0);

    // ดึง customer contacts จาก crm_logs (visits + calls)
    const { data: crmLogs, error: crmError } = await supabase
      .from('crm_logs')
      .select(`
        id,
        log_type,
        contact_person,
        content,
        logged_by,
        created_at
      `)
      .eq('project_id', PROJECT_ID)
      .eq(
        'created_at',
        `gte.${today}T00:00:00Z`
      )
      .eq(
        'created_at',
        `lt.${new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0]}T00:00:00Z`
      )
      .in('log_type', ['call', 'visit']);

    if (crmError) throw crmError;

    const visitCount = (crmLogs || []).filter(log => log.log_type === 'visit').length;
    const callCount = (crmLogs || []).filter(log => log.log_type === 'call').length;

    // ดึง messages จาก customer (ถ้า sender_name มี "customer" หรือ contact)
    const { data: customerMessages, error: msgError } = await supabase
      .from('messages')
      .select('id,sender_name,content,created_at')
      .eq('project_id', PROJECT_ID)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0] + 'T00:00:00Z');

    if (msgError) throw msgError;

    const customerChatCount = (customerMessages || []).length;

    return Response.json({
      success: true,
      date: today,
      summary: {
        total_customer_contacts: visitCount + callCount + customerChatCount,
        customer_visits: visitCount,
        customer_calls: callCount,
        customer_chats: customerChatCount,
        meetings: totalMeetings,
        sales_staff_count: salesLogs?.length || 0,
      },
      details: {
        crm_logs: crmLogs,
        sales_logs: salesLogs,
        message_count: customerChatCount,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch sales summary' },
      { status: 500 }
    );
  }
}
