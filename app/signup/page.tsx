"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanUsername || !cleanPassword) {
      setErrorText("Lütfen tüm alanları doldur.");
      setSuccessText("");
      return;
    }

    const { data: existingUser } = await supabase
      .from("app_users")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existingUser) {
      setErrorText("Bu kullanıcı adı zaten kayıtlı.");
      setSuccessText("");
      return;
    }

    const { error } = await supabase.from("app_users").insert({
      name: cleanName,
      username: cleanUsername,
      password: cleanPassword,
      role: "user",
      is_approved: true,
    });

    if (error) {
      setErrorText("Kayıt oluşturulamadı.");
      setSuccessText("");
      return;
    }

    setErrorText("");
    setSuccessText("Kayıt başarılı. Giriş ekranına yönlendiriliyorsun...");

    setTimeout(() => {
      router.push("/login");
    }, 1200);
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
          maxWidth: 440,
          background: "#111827",
          borderRadius: 20,
          padding: 28,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Kayıt Ol
        </h1>

        <p style={{ color: "#cbd5e1", marginBottom: 22 }}>
          Yeni kullanıcı oluştur.
        </p>

        <form onSubmit={handleSignup}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            style={inputStyle}
          />

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

          {successText && (
            <div style={{ marginBottom: 12, color: "#86efac", fontSize: 14 }}>
              {successText}
            </div>
          )}

          <button type="submit" style={signupButton}>
            Kayıt Ol
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 14, color: "#cbd5e1" }}>
          Zaten hesabın var mı?{" "}
          <Link href="/login" style={{ color: "#93c5fd", textDecoration: "none" }}>
            Giriş Yap
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

const signupButton: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 12,
  border: "none",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer",
};