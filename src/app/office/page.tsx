"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, ClipboardCheck,
  Receipt, FileText, Users, Phone, Briefcase, AlertCircle, Megaphone,
  Sparkles, Wrench, CheckCircle, AlertTriangle, Star, Download,
  XCircle, ShieldAlert, Package, Printer, ChevronDown, ChevronUp,
  FolderOpen, Upload, Search, Home, BookOpen, Pencil, ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import AttachDocButton from "@/components/AttachDocButton";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import { useCurrentUser } from "@/lib/user-context";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import { createNotification } from "@/lib/notify";
import Toast, { type ToastType } from "@/components/Toast";
import DeptAIChat from "@/components/DeptAIChat";
import { generateDocNumber } from "@/lib/doc-numbers";
import { SLA_DAYS, calcSlaDueAt } from "@/lib/approval-matrix";
