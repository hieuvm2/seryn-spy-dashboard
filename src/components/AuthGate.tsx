/* ============================================================
   SERYN Spy Ads — AUTH GATE.
   Bọc ngoài App: bắt buộc đăng nhập Google trước khi xem dashboard.
   - Chưa đăng nhập      -> màn hình đăng nhập Google.
   - Email ngoài @seryn.vn -> màn hình "không có quyền truy cập".
   - Email @seryn.vn      -> render App kèm thông tin user + role.
   - Supabase CHƯA cấu hình -> chạy chế độ demo, KHÔNG auth (dev/local).
   ============================================================ */
import React, { useEffect, useState } from "react";
import { ShieldX, LogOut, Loader2 } from "lucide-react";
import {
  isSupabaseConfigured,
  getSupabaseClient,
  signInWithGoogle,
  signOut,
  toAuthUser,
  ALLOWED_EMAIL_DOMAIN,
  type AuthUser,
} from "../utils/auth";

interface AuthGateProps {
  children: (auth: AuthUser | null) => React.ReactNode;
}

type GateState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "denied"; email: string }
  | { status: "ok"; user: AuthUser };

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans text-slate-800">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-4">
        <img src="/seryn-mark.png" alt="SERYN" className="w-12 h-12 object-contain" />
        <div>
          <h1 className="font-brand text-2xl font-bold tracking-[0.18em] text-slate-900">SERYN</h1>
          <p className="text-[11px] font-mono tracking-wider uppercase text-slate-400 font-bold mt-1">Competitor Intelligence</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AuthGate({ children }: AuthGateProps) {
  const authEnabled = isSupabaseConfigured();
  const [state, setState] = useState<GateState>(authEnabled ? { status: "loading" } : { status: "signed-out" });
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authEnabled) return;
    const client = getSupabaseClient();

    const apply = (email: string | null | undefined, user: ReturnType<typeof toAuthUser>) => {
      if (user) setState({ status: "ok", user });
      else if (email) setState({ status: "denied", email });
      else setState({ status: "signed-out" });
    };

    client.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      apply(u?.email, toAuthUser(u));
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      apply(u?.email, toAuthUser(u));
    });
    return () => sub.subscription.unsubscribe();
  }, [authEnabled]);

  // Không cấu hình Supabase -> chế độ demo/local, không chặn (không có dữ liệu thật để bảo vệ).
  if (!authEnabled) return <>{children(null)}</>;

  if (state.status === "loading") {
    return (
      <AuthShell>
        <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Đang kiểm tra phiên đăng nhập…</p>
      </AuthShell>
    );
  }

  if (state.status === "denied") {
    return (
      <AuthShell>
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
          <ShieldX className="w-6 h-6 text-rose-500" />
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-slate-900">Không có quyền truy cập</p>
          <p className="text-sm text-slate-500 mt-1.5">
            Tài khoản <span className="font-bold text-slate-700">{state.email}</span> không thuộc{" "}
            <span className="font-mono font-bold">@{ALLOWED_EMAIL_DOMAIN}</span>. Dashboard chỉ dành cho đội ngũ SERYN.
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-2 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất, dùng tài khoản khác
        </button>
      </AuthShell>
    );
  }

  if (state.status !== "ok") {
    return (
      <AuthShell>
        <p className="text-sm text-slate-500 -mt-1">
          Đăng nhập bằng tài khoản <span className="font-mono font-bold text-slate-700">@{ALLOWED_EMAIL_DOMAIN}</span> để xem dashboard.
        </p>
        <button
          onClick={async () => {
            setError("");
            setSigningIn(true);
            try {
              await signInWithGoogle(); // redirect sang Google
            } catch (e: any) {
              setError(e?.message || String(e));
              setSigningIn(false);
            }
          }}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm transition cursor-pointer disabled:opacity-60"
        >
          {signingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
          {signingIn ? "Đang chuyển sang Google…" : "Đăng nhập bằng Google"}
        </button>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Quyền xem: mọi email @{ALLOWED_EMAIL_DOMAIN} · Quản trị: theo danh sách được cấp.
        </p>
      </AuthShell>
    );
  }

  return <>{children(state.user)}</>;
}
