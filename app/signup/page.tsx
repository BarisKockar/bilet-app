"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authPageStyles } from "../../lib/auth-page-styles";
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
    <main className="theater-shell" style={authPageStyles.page}>
      <div
        className="theater-panel-strong theater-curtain"
        style={{
          maxWidth: 440,
          ...authPageStyles.card,
        }}
      >
        <div className="theater-chip" style={{ marginBottom: 18 }}>
          Oyuncu Kaydı
        </div>

        <h1 className="theater-title" style={{ marginTop: 0, marginBottom: 10, fontSize: 34 }}>
          Kayıt Ol
        </h1>

        <p className="theater-subtitle" style={{ marginBottom: 22 }}>
          Yeni kullanıcı oluştur.
        </p>

        <form onSubmit={handleSignup}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            style={authPageStyles.input}
          />

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

          {successText && (
            <div style={{ marginBottom: 12, color: "#86efac", fontSize: 14 }}>
              {successText}
            </div>
          )}

          <button type="submit" style={signupButton}>
            Kayıt Ol
          </button>
        </form>

        <div className="theater-subtitle" style={{ marginTop: 16, fontSize: 14 }}>
          Zaten hesabın var mı?{" "}
          <Link href="/login" style={authPageStyles.link}>
            Giriş Yap
          </Link>
        </div>
      </div>
    </main>
  );
}

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
