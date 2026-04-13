"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type EventItem = {
  id: number;
  title: string;
  event_date: string;
  slug: string;
};

export default function Home() {
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  useEffect(() => {
    const loggedIn = localStorage.getItem("is_logged_in");
    const savedUserName = localStorage.getItem("ticket_user_name");
    const savedRole = localStorage.getItem("ticket_user_role");

    if (loggedIn !== "true") {
      router.push("/login");
      return;
    }

    if (savedUserName) setUserName(savedUserName);
    if (savedRole) setUserRole(savedRole);

    setIsCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    if (isCheckingAuth) return;
    getEvents();
  }, [isCheckingAuth]);

  useEffect(() => {
    const channel = supabase
      .channel("events-home")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        () => {
          getEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function getEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      console.error("getEvents error:", error);
      return;
    }

    setEvents((data as EventItem[]) || []);
  }

  function logout() {
    localStorage.removeItem("is_logged_in");
    localStorage.removeItem("ticket_user_name");
    localStorage.removeItem("ticket_username");
    localStorage.removeItem("ticket_user_role");
    router.push("/login");
  }

  if (isCheckingAuth) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: isMobile ? "20px 12px" : "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: isMobile ? 28 : 36,
                fontWeight: 700,
                marginBottom: 10,
                marginTop: 0,
              }}
            >
              Bilet Satış Paneli
            </h1>

            <p style={{ color: "#cbd5e1", fontSize: 16, margin: 0 }}>
              Hoş geldin {userName || "Kullanıcı"}, oyun gününü seç.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              flexDirection: isMobile ? "column" : "row",
              width: isMobile ? "100%" : "auto",
            }}
          >
            {userRole === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                style={{ ...adminButton, width: isMobile ? "100%" : "auto" }}
              >
                Admin Paneli
              </button>
            )}

            <button
              onClick={logout}
              style={{ ...logoutButton, width: isMobile ? "100%" : "auto" }}
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {events.map((event, index) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`}
              style={{
                textDecoration: "none",
                color: "white",
                background: "linear-gradient(135deg, #1e293b, #334155)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                padding: 22,
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#22c55e",
                  color: "#052e16",
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                Gün {index + 1}
              </div>

              <h2
                style={{
                  fontSize: isMobile ? 20 : 24,
                  marginBottom: 8,
                  marginTop: 0,
                  fontWeight: 700,
                }}
              >
                {event.title}
              </h2>

              <p style={{ color: "#cbd5e1", marginBottom: 6 }}>
                Tarih: {event.event_date}
              </p>

              <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
                Satış ekranına git →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

const adminButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const logoutButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#ef4444",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};