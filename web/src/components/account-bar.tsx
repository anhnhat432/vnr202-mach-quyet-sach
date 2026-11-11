"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArenaApiError, request } from "@/features/arena/client/api";

type Identity = { role: "student" | "admin"; displayName?: string };
const leavePrivatePage = (href: string) => window.location.replace(href);

export function AccountBar({ enabled = true, onSignedOut = leavePrivatePage }: { enabled?: boolean; onSignedOut?: (href: string) => void }) {
  const pathname = usePathname();
  const [session, setSession] = useState<{ path: string | null; identity: Identity | null } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signingOut = useRef(false);
  const logoutButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const identity = session?.path === pathname ? session.identity : null;

  useEffect(() => {
    if (!enabled) return;
    let controller: AbortController | undefined;
    const load = async () => {
      if (signingOut.current) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const me = await request<Identity>("GET", "/me", { signal: current.signal });
        if (!current.signal.aborted && !signingOut.current) {
          setSession({ path: pathname, identity: me.role === "admin" || me.role === "student" ? { role: me.role, displayName: me.displayName } : null });
        }
      } catch {
        if (!current.signal.aborted && !signingOut.current) setSession({ path: pathname, identity: null });
      }
    };
    void load();
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, pathname]);

  useEffect(() => { if (confirm) confirmButton.current?.focus(); }, [confirm]);

  async function logout() {
    if (!identity || signingOut.current) return;
    signingOut.current = true;
    setBusy(true);
    setError(null);
    const target = identity.role === "admin" ? "/quan-tri/dang-nhap" : "/dang-nhap";
    try {
      await request("POST", "/auth/sign-out");
      setSession({ path: pathname, identity: null });
      onSignedOut(target);
    } catch (failure) {
      signingOut.current = false;
      setBusy(false);
      setError(failure instanceof ArenaApiError ? failure.message : "Chưa đăng xuất được. Hãy thử lại.");
    }
  }

  return (
    <nav className="account-bar" aria-label="Tài khoản">
      {identity ? <>
        <span>Đang đăng nhập: <strong>{identity.displayName || (identity.role === "admin" ? "Quản trị viên" : "Sinh viên")}</strong> · {identity.role === "admin" ? "Quản trị viên" : "Sinh viên"}</span>
        <Link href={identity.role === "admin" ? "/quan-tri/cuoc-thi" : "/live-arena"}>{identity.role === "admin" ? "Vào quản trị" : "Về sảnh chơi"}</Link>
        <button ref={logoutButton} type="button" disabled={busy} onClick={() => identity.role === "student" ? setConfirm(true) : void logout()}>Đăng xuất</button>
        {confirm ? <div className="account-bar__confirm" role="group" aria-label="Xác nhận đăng xuất">
          <p>Đồng hồ lượt đang chơi vẫn chạy khi đăng xuất. Đăng nhập lại để tiếp tục đúng lượt đó.</p>
          <button ref={confirmButton} type="button" disabled={busy} onClick={() => void logout()}>{busy ? "Đang đăng xuất…" : "Xác nhận đăng xuất"}</button>
          <button type="button" disabled={busy} onClick={() => { setConfirm(false); logoutButton.current?.focus(); }}>Hủy</button>
        </div> : null}
        {error ? <p role="alert">{error}</p> : null}
      </> : <><Link href="/dang-nhap">Đăng nhập sinh viên</Link><Link href="/quan-tri/dang-nhap">Đăng nhập quản trị</Link></>}
    </nav>
  );
}
