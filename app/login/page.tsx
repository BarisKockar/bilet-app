"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { data: user, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username.trim().toLowerCase())
      .eq("password", password.trim())
      .maybeSingle();

    if (error || !user) {
      setErrorText("Kullanıcı adı veya şifre yanlış.");
      return;
    }

    if (!user.is_approved) {
      setErrorText("Bu kullanıcı onaylı değil.");
      return;
    }

    localStorage.setItem("is_logged_in", "true");
    localStorage.setItem("ticket_user_name", user.name);
    localStorage.setItem("ticket_username", user.username);
    localStorage.setItem("ticket_user_role", user.role);

    router.push("/");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1020",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#111827",
          borderRadius: 20,
          padding: 28,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Giriş Yap
        </h1>

        <p style={{ color: "#cbd5e1", marginBottom: 22 }}>
          Bilet satış paneline erişmek için giriş yap.
        </p>

        <form onSubmit={handleLogin}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Kullanıcı adı"
            style={inputStyle}
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            type="password"
            style={inputStyle}
          />

          {errorText && (
            <div style={{ marginBottom: 12, color: "#fca5a5", fontSize: 14 }}>
              {errorText}
            </div>
          )}

          <button type="submit" style={loginButton}>
            Giriş Yap
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 14, color: "#cbd5e1" }}>
          Hesabın yok mu?{" "}
          <Link href="/signup" style={{ color: "#93c5fd", textDecoration: "none" }}>
            Kayıt Ol
          </Link>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0f172a",
  color: "white",
  marginBottom: 14,
  outline: "none",
};

const loginButton: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 12,
  border: "none",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer",
};