"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authPageStyles } from "../../lib/auth-page-styles";
import { saveStoredSession } from "../../lib/auth-storage";
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

    saveStoredSession({
      userName: user.name,
      username: user.username,
      userRole: user.role,
    });

    router.push("/");
  }

  return (
    <main className="theater-shell" style={authPageStyles.page}>
      <div
        className="theater-panel-strong theater-curtain"
        style={{
          maxWidth: 420,
          ...authPageStyles.card,
        }}
      >
        <div className="theater-chip" style={{ marginBottom: 18 }}>
          Sahne Girişi
        </div>

        <h1 className="theater-title" style={{ marginTop: 0, marginBottom: 10, fontSize: 34 }}>
          Giriş Yap
        </h1>

        <p className="theater-subtitle" style={{ marginBottom: 22 }}>
          Bilet satış paneline erişmek için giriş yap.
        </p>

        <form onSubmit={handleLogin}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Kullanıcı adı"
            style={authPageStyles.input}
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            type="password"
            style={authPageStyles.input}
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

        <div className="theater-subtitle" style={{ marginTop: 16, fontSize: 14 }}>
          Hesabın yok mu?{" "}
          <Link href="/signup" style={authPageStyles.link}>
            Kayıt Ol
          </Link>
        </div>
      </div>
    </main>
  );
}

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
