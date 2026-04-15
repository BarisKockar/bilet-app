"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearStoredSession, getStoredSession } from "../lib/auth-storage";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/use-is-mobile";

type EventItem = {
  id: number;
  title: string;
  event_date: string;
  slug: string;
};

type CustomerMailItem = {
  id: number;
  email: string;
  created_at: string;
  ticket_codes: string[];
  event_dates: string[];
};

type CustomerMailTrackingRow = {
  id: number;
  email: string;
  created_at: string;
  is_checked?: boolean;
};

function formatEventDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function Home() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  const [customerMails, setCustomerMails] = useState<CustomerMailItem[]>([]);
  const [showMailMenu, setShowMailMenu] = useState(false);
  const [loadingMails, setLoadingMails] = useState(false);

  useEffect(() => {
    const session = getStoredSession();

    if (!session.isLoggedIn) {
      router.push("/login");
      return;
    }

    if (session.userName) setUserName(session.userName);
    if (session.userRole) setUserRole(session.userRole);

    setIsCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    if (isCheckingAuth) return;
    void getEvents();
    void syncCustomerMails();
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
          void getEvents();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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

  async function syncCustomerMails() {
    setLoadingMails(true);

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("customer_email, seat_id, event_id")
      .order("created_at", { ascending: false });

    if (salesError) {
      console.error("syncCustomerMails sales error:", salesError);
      setLoadingMails(false);
      return;
    }

    const salesRows =
      (salesData as { customer_email?: string; seat_id?: number; event_id?: number }[]) || [];

    const gmailEmails = Array.from(
      new Set(
        salesRows
          .map((item) => (item.customer_email || "").trim().toLowerCase())
          .filter((email) => email.endsWith("@gmail.com"))
      )
    );

    const { data: existingTrackingData, error: existingTrackingError } = await supabase
      .from("customer_mail_tracking")
      .select("id, email, created_at, is_checked");

    if (existingTrackingError) {
      console.error("syncCustomerMails existing tracking error:", existingTrackingError);
      setLoadingMails(false);
      return;
    }

    const existingTrackingRows = (existingTrackingData as CustomerMailTrackingRow[]) || [];
    const existingTrackingEmails = new Set(
      existingTrackingRows.map((item) => (item.email || "").trim().toLowerCase())
    );

    const rowsToInsert = gmailEmails
      .filter((email) => !existingTrackingEmails.has(email))
      .map((email) => ({ email }));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("customer_mail_tracking")
        .insert(rowsToInsert);

      if (insertError) {
        console.error("syncCustomerMails insert error:", insertError);
      }
    }

    const seatIds = Array.from(
      new Set(
        salesRows
          .map((row) => row.seat_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    const seatCodeMap = new Map<number, string>();
    const eventDateMap = new Map<number, string>();

    if (seatIds.length > 0) {
      const { data: seatsData, error: seatsError } = await supabase
        .from("seats")
        .select("id, seat_code")
        .in("id", seatIds);

      if (seatsError) {
        console.error("syncCustomerMails seats error:", seatsError);
      } else {
        ((seatsData as { id: number; seat_code: string }[]) || []).forEach((seat) => {
          seatCodeMap.set(seat.id, seat.seat_code);
        });
      }
    }

    const eventIds = Array.from(
      new Set(
        salesRows
          .map((row) => row.event_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    if (eventIds.length > 0) {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id, event_date")
        .in("id", eventIds);

      if (eventsError) {
        console.error("syncCustomerMails events error:", eventsError);
      } else {
        ((eventsData as { id: number; event_date: string }[]) || []).forEach((event) => {
          eventDateMap.set(event.id, formatEventDate(event.event_date));
        });
      }
    }

    const emailToTickets = new Map<string, string[]>();
    const emailToDates = new Map<string, string[]>();

    for (const row of salesRows) {
      const email = (row.customer_email || "").trim().toLowerCase();
      if (!email.endsWith("@gmail.com")) continue;

      const seatCode =
        typeof row.seat_id === "number" ? seatCodeMap.get(row.seat_id) : undefined;
      const eventDate =
        typeof row.event_id === "number" ? eventDateMap.get(row.event_id) : undefined;

      if (!emailToTickets.has(email)) {
        emailToTickets.set(email, []);
      }

      if (!emailToDates.has(email)) {
        emailToDates.set(email, []);
      }

      if (seatCode) {
        const arr = emailToTickets.get(email)!;
        if (!arr.includes(seatCode)) {
          arr.push(seatCode);
        }
      }

      if (eventDate) {
        const arr = emailToDates.get(email)!;
        if (!arr.includes(eventDate)) {
          arr.push(eventDate);
        }
      }
    }

    const { data: trackingData, error: trackingError } = await supabase
      .from("customer_mail_tracking")
      .select("id, email, created_at, is_checked")
      .eq("is_checked", false)
      .order("created_at", { ascending: false });

    if (trackingError) {
      console.error("syncCustomerMails tracking error:", trackingError);
      setLoadingMails(false);
      return;
    }

    const trackingRows = (trackingData as CustomerMailTrackingRow[]) || [];
    const finalRows: CustomerMailItem[] = trackingRows.map(
      (item) => ({
        id: item.id,
        email: item.email,
        created_at: item.created_at,
        ticket_codes: emailToTickets.get(item.email) || [],
        event_dates: emailToDates.get(item.email) || [],
      })
    );

    setCustomerMails(finalRows);
    setLoadingMails(false);
  }

  async function removeTrackedMail(item: CustomerMailItem) {
    const ok = window.confirm("Mail atıldı mı gençler?");
    if (!ok) return;

    const { error } = await supabase
      .from("customer_mail_tracking")
      .update({ is_checked: true })
      .eq("id", item.id);

    if (error) {
      console.error("removeTrackedMail error:", error);
      alert("Mail listeden silinemedi.");
      return;
    }

    setCustomerMails((prev) => prev.filter((mail) => mail.id !== item.id));
  }

  function logout() {
    clearStoredSession();
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
              position: "relative",
              flexDirection: isMobile ? "column" : "row",
              width: isMobile ? "100%" : "auto",
            }}
          >
            <button
              onClick={() => {
                const next = !showMailMenu;
                setShowMailMenu(next);
                if (next) {
                  void syncCustomerMails();
                }
              }}
              style={{ ...mailMenuButton, width: isMobile ? "100%" : "auto" }}
            >
              Müşteri Mail Takibi
            </button>

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

            {showMailMenu && (
              <div
                style={{
                  ...mailMenuBox,
                  right: isMobile ? "auto" : 0,
                  left: isMobile ? 0 : "auto",
                  width: isMobile ? "100%" : 340,
                  maxWidth: isMobile ? "100%" : "90vw",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 10,
                    fontSize: 14,
                    color: "white",
                  }}
                >
                  Gmail Müşteri Takibi
                </div>

                {loadingMails ? (
                  <div style={{ color: "#cbd5e1", fontSize: 14 }}>Yükleniyor...</div>
                ) : customerMails.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 14 }}>
                    Henüz gmail müşteri kaydı yok.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {customerMails.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => void removeTrackedMail(item)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 6,
                          background: "#0f172a",
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 14,
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          wordBreak: "break-word",
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{item.email}</span>

                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          Biletler: {item.ticket_codes.length > 0 ? item.ticket_codes.join(", ") : "Yok"}
                        </span>

                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          Günler: {item.event_dates.length > 0 ? item.event_dates.join(", ") : "Yok"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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

const mailMenuButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#8b5cf6",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const mailMenuBox: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  marginTop: 8,
  width: 340,
  maxWidth: "90vw",
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  zIndex: 999,
};
