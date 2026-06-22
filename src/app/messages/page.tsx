"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  Search,
  Plus,
  Phone,
  MessageSquare,
  Users,
  Clock,
  CheckCheck,
  Smile,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: string;
  recipient_id?: string;
  channel_id?: string;
  attachments: any[];
  read_by_ids: string[];
  created_at: string;
}

interface Channel {
  id: string;
  name: string;
  channel_type: string;
  description?: string;
  member_ids: string[];
}

export default function MessagesPage() {
  const user = useCurrentUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChat, setActiveChat] = useState<{ id: string; type: "dm" | "channel" } | null>(
    null
  );
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChannels();
    loadMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChannels = async () => {
    try {
      const { data, error } = await supabase.from("message_channels").select("*");

      if (!error && data) {
        setChannels(data);
      }
    } catch (err) {
      console.error("Failed to load channels:", err);
    }
  };

  const loadMessages = async () => {
    if (!activeChat) return;

    try {
      setLoading(true);
      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });

      if (activeChat.type === "dm") {
        query = query.or(`recipient_id.eq.${activeChat.id},sender_id.eq.${activeChat.id}`);
      } else {
        query = query.eq("channel_id", activeChat.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat || !user) return;

    try {
      const newMessage = {
        sender_id: user.id,
        sender_name: user.full_name,
        message_type: activeChat.type === "dm" ? "direct" : "group",
        recipient_id: activeChat.type === "dm" ? activeChat.id : null,
        channel_id: activeChat.type === "channel" ? activeChat.id : null,
        content: messageText,
        attachments: [],
      };

      const { data, error } = await supabase
        .from("messages")
        .insert([newMessage])
        .select()
        .single();

      if (!error && data) {
        setMessages([...messages, data]);
        setMessageText("");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="💬 Messages" subtitle="Direct messaging & team chat" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Channels & DMs */}
          <div className="lg:col-span-1">
            <GlassCard>
              <div className="p-4">
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text placeholder-aviva-secondary"
                  />
                </div>

                {/* Channels List */}
                <h3 className="text-sm font-bold text-aviva-text mb-3">Channels</h3>
                <div className="space-y-2 mb-6">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setActiveChat({ id: channel.id, type: "channel" })}
                      className={`w-full text-left px-3 py-2 rounded-lg transition ${
                        activeChat?.id === channel.id
                          ? "bg-aviva-gold/20 border border-aviva-gold/50"
                          : "hover:bg-aviva-bg/50"
                      }`}
                    >
                      <p className="text-sm font-semibold text-aviva-text"># {channel.name}</p>
                      <p className="text-xs text-aviva-secondary">{channel.member_ids.length} members</p>
                    </button>
                  ))}
                </div>

                {/* New Channel Button */}
                <button className="w-full px-3 py-2 bg-aviva-gold/20 border border-aviva-gold/30 rounded-lg text-aviva-gold hover:bg-aviva-gold/30 transition flex items-center gap-2">
                  <Plus size={16} />
                  <span className="text-sm font-semibold">New Channel</span>
                </button>
              </div>
            </GlassCard>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-2">
            {activeChat ? (
              <GlassCard className="h-[600px] flex flex-col">
                {/* Chat Header */}
                <div className="border-b border-aviva-gold/20 p-4">
                  <h2 className="text-lg font-bold text-aviva-text">
                    {activeChat.type === "channel"
                      ? channels.find((c) => c.id === activeChat.id)?.name || "Channel"
                      : "Direct Message"}
                  </h2>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loading ? (
                    <p className="text-center text-aviva-secondary">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-aviva-secondary">No messages yet. Say something!</p>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="space-y-1">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-aviva-gold/20 rounded-full flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-aviva-text">
                                {msg.sender_name || "Unknown"}
                              </p>
                              <span className="text-xs text-aviva-secondary">
                                {new Date(msg.created_at).toLocaleTimeString("th-TH")}
                              </span>
                            </div>
                            <p className="text-sm text-aviva-text break-words">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-aviva-gold/20 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text placeholder-aviva-secondary"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-4 py-2 bg-aviva-gold text-aviva-bg rounded-lg hover:bg-yellow-500 transition flex items-center gap-2"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="h-[600px] flex items-center justify-center">
                <p className="text-center text-aviva-secondary">
                  Select a channel or person to start messaging
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
