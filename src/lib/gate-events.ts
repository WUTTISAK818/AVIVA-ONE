import "server-only";
import { supabaseAdmin } from "./supabase-server";

export interface AlprPayload {
  timestamp?: string;
  license_plate: string;
  province?: string;
  confidence?: number;
  photo_url?: string;
  vehicle_type?: string;
  event_type?: string;
  raw?: unknown;
}

export interface GateRow {
  id: string;
  code: string;
  direction: "entry" | "exit";
}

export type MatchType = "resident" | "visitor" | "blacklist" | "unknown" | "manual";
export type GateAction = "auto_open" | "manual_open" | "denied" | "pending_guard";

export interface GateDecision {
  event_id: string;
  action: GateAction;
  match_type: MatchType;
  matched_id: string | null;
  matched_table: string | null;
  reason?: string;
}

const CONFIDENCE_THRESHOLD = 0.8;
const PRE_ARRIVAL_GRACE_MS = 30 * 60 * 1000;

function normalize(plate: string) {
  return plate.replace(/[\s\-_]+/g, "").toLowerCase();
}

export async function processGateEvent(
  payload: AlprPayload,
  gate: GateRow,
  options: { manualDecidedBy?: string } = {}
): Promise<GateDecision> {
  const rawPlate = payload.license_plate ?? "";
  const norm = normalize(rawPlate);
  const confidence = typeof payload.confidence === "number" ? payload.confidence : null;

  let action: GateAction = "pending_guard";
  let matchType: MatchType = "unknown";
  let matchedId: string | null = null;
  let matchedTable: string | null = null;
  let reason: string | undefined;

  if (confidence !== null && confidence < CONFIDENCE_THRESHOLD) {
    reason = `low_confidence:${confidence.toFixed(2)}`;
  } else if (!norm) {
    reason = "empty_plate";
  } else {
    const decision = await decideAction(norm, gate);
    action = decision.action;
    matchType = decision.match_type;
    matchedId = decision.matched_id;
    matchedTable = decision.matched_table;
    reason = decision.reason;
  }

  const { data: event, error } = await supabaseAdmin
    .from("gate_events")
    .insert({
      gate_id: gate.id,
      event_at: payload.timestamp ?? new Date().toISOString(),
      event_type: payload.event_type ?? "plate_detected",
      license_plate: rawPlate,
      license_plate_norm: norm,
      confidence,
      photo_url: payload.photo_url ?? null,
      match_type: matchType,
      matched_id: matchedId,
      matched_table: matchedTable,
      action,
      decided_by: options.manualDecidedBy ?? null,
      raw_payload: payload.raw ?? payload,
    })
    .select("id")
    .single();
  if (error || !event) {
    throw new Error(`gate_event insert failed: ${error?.message ?? "unknown"}`);
  }

  return { event_id: event.id, action, match_type: matchType, matched_id: matchedId, matched_table: matchedTable, reason };
}

async function decideAction(norm: string, gate: GateRow): Promise<{
  action: GateAction;
  match_type: MatchType;
  matched_id: string | null;
  matched_table: string | null;
  reason?: string;
}> {
  // 1) Blacklist
  const { data: bl } = await supabaseAdmin
    .from("blacklist")
    .select("id")
    .eq("license_plate_norm", norm)
    .eq("active", true)
    .maybeSingle();
  if (bl) {
    return { action: "denied", match_type: "blacklist", matched_id: bl.id, matched_table: "blacklist", reason: "blacklisted_plate" };
  }

  // 2) Resident whitelist
  const { data: rv } = await supabaseAdmin
    .from("resident_vehicles")
    .select("id")
    .eq("license_plate_norm", norm)
    .eq("is_whitelist", true)
    .maybeSingle();
  if (rv) {
    return { action: "auto_open", match_type: "resident", matched_id: rv.id, matched_table: "resident_vehicles" };
  }

  // 3) Visitor pre-registration window
  const nowMs = Date.now();
  const upperBound = new Date(nowMs + PRE_ARRIVAL_GRACE_MS).toISOString();
  const nowIso = new Date(nowMs).toISOString();
  const { data: visitor } = await supabaseAdmin
    .from("visitors")
    .select("id, expected_at, expires_at")
    .eq("license_plate_norm", norm)
    .gte("expires_at", nowIso)
    .lte("expected_at", upperBound)
    .order("expected_at", { ascending: false })
    .maybeSingle();
  if (!visitor) {
    return { action: "pending_guard", match_type: "unknown", matched_id: null, matched_table: null, reason: "no_match" };
  }

  const { data: pass } = await supabaseAdmin
    .from("visitor_passes")
    .select("id, status")
    .eq("visitor_id", visitor.id)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (pass) {
    if (gate.direction === "entry" && pass.status === "pending") {
      await supabaseAdmin
        .from("visitor_passes")
        .update({ status: "checked_in", checked_in_at: nowIso, checked_in_gate: gate.id })
        .eq("id", pass.id);
      return { action: "auto_open", match_type: "visitor", matched_id: pass.id, matched_table: "visitor_passes" };
    }
    if (gate.direction === "exit" && pass.status === "checked_in") {
      await supabaseAdmin
        .from("visitor_passes")
        .update({ status: "checked_out", checked_out_at: nowIso })
        .eq("id", pass.id);
      return { action: "auto_open", match_type: "visitor", matched_id: pass.id, matched_table: "visitor_passes" };
    }
    if (gate.direction === "entry" && pass.status === "checked_in") {
      return { action: "pending_guard", match_type: "visitor", matched_id: pass.id, matched_table: "visitor_passes", reason: "already_inside" };
    }
  }

  return { action: "auto_open", match_type: "visitor", matched_id: visitor.id, matched_table: "visitors" };
}
