import { supabase } from "@/lib/supabase";
import { NextResponse, NextRequest } from "next/server";

interface ActivityData {
  [date: string]: {
    sales: { count: number; items: any[] };
    construction: { count: number; items: any[] };
    accounting: { count: number; items: any[] };
    finance: { count: number; items: any[] };
    marketing: { count: number; items: any[] };
    hr: { count: number; items: any[] };
    approvals: { count: number; items: any[] };
    office: { count: number; items: any[] };
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const range = searchParams.get("range") || "month";
    const department = searchParams.get("department");

    const startDate = getStartDate(date, range);
    const endDate = getEndDate(date, range);

    const activityData: ActivityData = {};

    // Initialize all dates in range
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      activityData[dateKey] = {
        sales: { count: 0, items: [] },
        construction: { count: 0, items: [] },
        accounting: { count: 0, items: [] },
        finance: { count: 0, items: [] },
        marketing: { count: 0, items: [] },
        hr: { count: 0, items: [] },
        approvals: { count: 0, items: [] },
        office: { count: 0, items: [] },
      };
    }

    // Fetch sales activities (leads, quotes)
    const { data: leads } = await supabase
      .from("leads")
      .select("id,customer_name,created_at,status")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (leads) {
      leads.forEach((lead: any) => {
        const dateKey = lead.created_at.split("T")[0];
        if (activityData[dateKey]) {
          activityData[dateKey].sales.count++;
          activityData[dateKey].sales.items.push(lead);
        }
      });
    }

    // Fetch construction activities (houses, progress)
    const { data: houses } = await supabase
      .from("houses")
      .select("id,house_number,status,created_at,progress")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (houses) {
      houses.forEach((house: any) => {
        const dateKey = house.created_at.split("T")[0];
        if (activityData[dateKey]) {
          activityData[dateKey].construction.count++;
          activityData[dateKey].construction.items.push(house);
        }
      });
    }

    // Fetch finance transactions
    const { data: transactions } = await supabase
      .from("finance_transactions")
      .select("id,amount,transaction_type,created_at,description")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (transactions) {
      transactions.forEach((txn: any) => {
        const dateKey = txn.created_at.split("T")[0];
        if (activityData[dateKey]) {
          if (txn.transaction_type === "income") {
            activityData[dateKey].finance.count++;
            activityData[dateKey].finance.items.push(txn);
          } else if (txn.transaction_type === "expense") {
            activityData[dateKey].accounting.count++;
            activityData[dateKey].accounting.items.push(txn);
          }
        }
      });
    }

    // Fetch approvals
    const { data: approvals } = await supabase
      .from("approvals")
      .select("id,workflow_type,status,created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .eq("status", "approved");

    if (approvals) {
      approvals.forEach((approval: any) => {
        const dateKey = approval.created_at.split("T")[0];
        if (activityData[dateKey]) {
          activityData[dateKey].approvals.count++;
          activityData[dateKey].approvals.items.push(approval);
        }
      });
    }

    // Fetch employee activities (attendance, leave)
    const { data: attendance } = await supabase
      .from("attendance")
      .select("id,user_id,check_in_time,check_out_time,created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (attendance) {
      attendance.forEach((att: any) => {
        const dateKey = att.created_at.split("T")[0];
        if (activityData[dateKey]) {
          activityData[dateKey].hr.count++;
          activityData[dateKey].hr.items.push(att);
        }
      });
    }

    // Fetch documents
    const { data: documents } = await supabase
      .from("documents")
      .select("id,doc_type,status,created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (documents) {
      documents.forEach((doc: any) => {
        const dateKey = doc.created_at.split("T")[0];
        if (activityData[dateKey]) {
          activityData[dateKey].office.count++;
          activityData[dateKey].office.items.push(doc);
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: activityData,
      range: { startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching dashboard activities:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

function getStartDate(date: string, range: string): string {
  const d = new Date(date);

  if (range === "day") {
    return date;
  } else if (range === "week") {
    const first = d.getDate() - d.getDay();
    return new Date(d.setDate(first)).toISOString().split("T")[0];
  } else {
    // month
    return `${date.substring(0, 7)}-01`;
  }
}

function getEndDate(date: string, range: string): string {
  const d = new Date(date);

  if (range === "day") {
    return date;
  } else if (range === "week") {
    const last = d.getDate() - d.getDay() + 6;
    return new Date(d.setDate(last)).toISOString().split("T")[0];
  } else {
    // month
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
  }
}
