"use client";

import { useEffect, useState, useRef } from "react";
import { Home, Users, Package, LogOut, Receipt, ShieldAlert, BadgeCheck, Settings, X, Sparkles, Bot, Send, CheckCircle, HardHat, FileText, Briefcase, TrendingUp, TrendingDown, Activity, Target, Zap, AlertTriangle, Clock, ClipboardList } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import ProgressBar from "@/components/ProgressBar";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import CalendarWidget from "@/components/CalendarWidget";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";