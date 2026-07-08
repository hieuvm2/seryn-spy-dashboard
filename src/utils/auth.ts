/* ============================================================
   SERYN Spy Ads — AUTH (Supabase Auth + Google OAuth).
   - Đăng nhập bằng Google. Chỉ email @seryn.vn được vào dashboard.
   - Phân quyền:
       admin  : ADMIN_EMAILS (toàn quyền — đọc/ghi, nhập/xóa dữ liệu)
       viewer : mọi email @seryn.vn khác (chỉ xem)
   - Client Supabase ở đây là client DUY NHẤT của frontend (persist
     session). supabaseData.ts cũng dùng client này để request đọc
     dữ liệu mang JWT của user (RLS kiểm tra email @seryn.vn).
   ============================================================ */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

/** Email quản trị viên — toàn quyền trên dashboard. */
export const ADMIN_EMAILS = ["hieuvm2@seryn.vn"];

/** Domain email được cấp quyền XEM dashboard. */
export const ALLOWED_EMAIL_DOMAIN = "seryn.vn";

export type UserRole = "admin" | "viewer";

export interface AuthUser {
  email: string;
  role: UserRole;
  name?: string;
  avatarUrl?: string;
}

/** Đã cấu hình Supabase chưa (không có -> app chạy chế độ demo, không auth). */
export function isSupabaseConfigured(): boolean {
  return !!URL && !!ANON;
}

let _client: SupabaseClient | null = null;

/** Client Supabase dùng chung cho toàn frontend (auth + đọc dữ liệu). */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  if (!_client) _client = createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } });
  return _client;
}

/** Xác định role theo email. Trả null nếu email không thuộc @seryn.vn (bị từ chối). */
export function resolveRole(email: string | null | undefined): UserRole | null {
  const e = (email || "").trim().toLowerCase();
  if (!e) return null;
  if (ADMIN_EMAILS.includes(e)) return "admin";
  if (e.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return "viewer";
  return null;
}

/** Map User (Supabase) -> AuthUser (kèm role). Trả null nếu không được phép. */
export function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  const email = (user.email || "").trim().toLowerCase();
  const role = resolveRole(email);
  if (!role) return null;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  return {
    email,
    role,
    name: typeof meta.full_name === "string" ? meta.full_name : undefined,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : undefined,
  };
}

/** Đăng nhập bằng Google (redirect OAuth). `hd` gợi ý Google ưu tiên tài khoản @seryn.vn. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error) throw new Error(`Đăng nhập Google lỗi: ${error.message}`);
}

/** Đăng xuất. */
export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}
