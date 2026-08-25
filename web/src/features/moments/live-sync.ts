"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lớp đồng bộ realtime cho Giờ G — dùng Supabase Realtime *broadcast* (kênh pub/sub tạm thời,
// KHÔNG ghi bảng, KHÔNG cần RLS, KHÔNG cần Docker/local). Đây là bỏ phiếu trực tiếp cho chế độ
// luyện tập, hoàn toàn tách khỏi hệ thi đấu tính điểm chính thức. Nếu chưa cấu hình Supabase,
// mọi hàm trả về null và Giờ G tự chạy chế độ đếm phiếu thủ công.

let client: SupabaseClient | null = null;

export function liveConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && /^https?:\/\//.test(url) && key.length >= 20) {
    return { url, key };
  }
  return null;
}

export function getLiveClient(): SupabaseClient | null {
  const cfg = liveConfig();
  if (!cfg) return null;
  if (!client) {
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export function roomChannelName(room: string): string {
  return `giog:${room.toLowerCase()}`;
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
