"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AppUser = {
  id: number;
  name: string;
  username: string;
  password: string;
  role: "admin" | "user";
  is_approved: boolean;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningReset, setRunningReset] = useState(false);

  useEffect(() => {
    const loggedIn = localStorage.getItem("is_logged_in");
    const role = localStorage.getItem("ticket_user_role");

    if (loggedIn !== "true" || role !== "admin") {
      router.push("/login");
      return;
    }

    getUsers();
  }, [router]);

  async function getUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setUsers((data as AppUser[]) || []);
    }

    setLoading(false);
  }

  async function deleteUser(id: number, username: string) {
    const currentUsername = localStorage.getItem("ticket_username");

    if (username === currentUsername) {
      alert("Kendi hesabını buradan silemezsin.");
      return;
    }

    const ok = window.confirm(`${username} kullanıcısını silmek istiyor musun?`);
    if (!ok) return;

    await supabase.from("app_users").delete().eq("id", id);
    await getUsers();
  }

  async function toggleApproval(user: AppUser) {
    await supabase
      .from("app_users")
      .update({ is_approved: !user.is_approved })
      .eq("id", user.id);

    await getUsers();
  }

  async function resetAllSystem() {
    const ok = window.confirm(
      "Tüm satışlar, bildirimler ve koltuk durumları sıfırlanacak. Emin misin?"
    );
    if (!ok) return;

    setRunningReset(true);

    await supabase.from("notifications").delete().neq("id", 0);
    await supabase.from("sales").delete().neq("id", 0);
    await supabase
      .from("seats")
      .update({
        status: "available",
        locked_by: null,
        locked_at: null,
      })
      .neq("id", 0);

    setRunningReset(false);
    alert("Sistem sıfırlandı.");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "white",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 32 }}>Admin Paneli</h1>
            <p style={{ color: "#cbd5e1" }}>
              Kullanıcı yönetimi ve sistem sıfırlama
            </p>
          </div>

          <button onClick={() => router.push("/")} style={secondaryBtn}>
            Ana Sayfa
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 20,
          }}
        >
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Sistem İşlemleri</h2>

            <button
              onClick={resetAllSystem}
              style={dangerBtn}
              disabled={runningReset}
            >
              {runningReset ? "Sıfırlanıyor..." : "Tüm Satışları ve Bildirimleri Sıfırla"}
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Kullanıcılar</h2>

            {loading ? (
              <p>Yükleniyor...</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {users.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      background: "#0f172a",
                      borderRadius: 14,
                      padding: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{user.name}</div>
                      <div>Kullanıcı adı: {user.username}</div>
                      <div>Rol: {user.role}</div>
                      <div>Durum: {user.is_approved ? "Onaylı" : "Kapalı"}</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => toggleApproval(user)}
                        style={warnBtn}
                      >
                        {user.is_approved ? "Erişimi Kapat" : "Erişimi Aç"}
                      </button>

                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        style={dangerBtnSmall}
                      >
                        Kullanıcıyı Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#111827",
  padding: 20,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#334155",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const warnBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "none",
  background: "#f59e0b",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtnSmall: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "none",
  background: "#ef4444",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};