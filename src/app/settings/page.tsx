"use client";
import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, Settings, Users, Building2, ChevronRight, User, Save, Check, BookOpen, FileText, GitBranch, ClipboardList } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import Link from "next/link";