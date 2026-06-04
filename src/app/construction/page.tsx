"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle, Clock, Plus, X, ClipboardList, Pencil, Bug, Printer, ChevronRight, ChevronDown, Camera, HardHat, FileText, Loader2, Check, Bot, Send, Trash2 } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import Toast, { type ToastType } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/notify";
import { useCurrentUser } from "@/lib/user-context";
import { generateDocNumber } from "@/lib/doc-numbers";
import { calcSlaDueAt } from "@/lib/approval-matrix";
import AttachDocButton from "@/components/AttachDocButton";
