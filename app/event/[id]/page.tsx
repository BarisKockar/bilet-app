"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SeatItem = {
  id: number;
  event_id: number;
  seat_code: string;
  row_no: string;
  seat_no: number;
  status: string;
  locked_by?: string | null;
  locked_at?: string | null;
};

type NotificationItem = {
  id: number;
  event_id: number;
  type: string;
  message: string;
  created_at: string;
};

type SettingsItem = {
  bank_name: string;
  iban_name: string;
  iban_number: string;
};

type SaleRow = {
  amount: number;
  payment_type: "cash" | "iban";
};

const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const maxRows = 20;

export default function Page() {
  const params = useParams();
  const eventId = Number(params.id);

  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "iban">("cash");
  const [amount, setAmount] = useState("");
  const [userName, setUserName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ibanInfo, setIbanInfo] = useState<SettingsItem>({
    bank_name: "",
    iban_name: "",
    iban_number: "",
  });

  useEffect(() => {
    const savedName = localStorage.getItem("ticket_user_name");

    if (savedName) {
      setUserName(savedName);
      return;
    }

    const name = window.prompt("Kullanıcı adını gir");
    if (name && name.trim()) {
      localStorage.setItem("ticket_user_name", name.trim());
      setUserName(name.trim());
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;

    getSeats();
    getNotifications();
    getSettings();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const seatChannel = supabase
      .channel(`event-seats-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seats",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          getSeats();
        }
      )
      .subscribe();

    const notificationChannel = supabase
      .channel(`event-notifications-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          getNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(seatChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [eventId]);

  async function getSeats() {
    const { data, error } = await supabase
      .from("seats")
      .select("*")
      .eq("event_id", eventId);

    if (error) {
      console.error("getSeats error:", error);
      return;
    }

    setSeats((data as SeatItem[]) || []);
  }

  async function getNotifications() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.error("getNotifications error:", error);
      return;
    }

    setNotifications((data as NotificationItem[]) || []);
  }

  async function getSettings() {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      console.error("getSettings error:", error);
      return;
    }

    if (data) {
      setIbanInfo(data as SettingsItem);
    }
  }

  async function handleSeatClick(seat: SeatItem) {
    if (!userName) {
      alert("Önce kullanıcı adı tanımlanmalı.");
      return;
    }

    if (seat.status === "sold") return;
    if (seat.status === "locking") return;

    const { data, error } = await supabase.rpc("lock_seat", {
      p_event_id: eventId,
      p_seat_id: seat.id,
      p_user_name: userName,
    });

    if (error) {
      console.error("lock_seat error:", error);
      alert("Koltuk kilitlenemedi.");
      return;
    }

    if (!data?.success) {
      alert(data?.message || "Koltuk şu anda işlemde.");
      await getSeats();
      return;
    }

    setSelectedSeat({
      ...seat,
      status: "locking",
      locked_by: userName,
    });
  }

  async function completeSale() {
  if (!selectedSeat) return;

  if (!customerName.trim() || !customerEmail.trim() || !amount) {
    alert("Lütfen tüm alanları doldur.");
    return;
  }

  setIsSubmitting(true);

  const { data, error } = await supabase.rpc("complete_sale", {
    p_event_id: eventId,
    p_seat_id: selectedSeat.id,
    p_customer_name: customerName.trim(),
    p_customer_email: customerEmail.trim(),
    p_payment_type: paymentType,
    p_amount: Number(amount),
  });

  if (error) {
    console.error("complete_sale error:", error);
    setIsSubmitting(false);
    alert("Satış tamamlanamadı.");
    return;
  }

  if (!data?.success) {
    setIsSubmitting(false);
    alert(data?.message || "Satış başarısız.");
    return;
  }

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError) {
    console.error("event fetch error:", eventError);
  }

  try {
    const mailResponse = await fetch("/api/send-ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        seatCode: selectedSeat.seat_code,
        eventTitle: eventData?.title || `Etkinlik ${eventId}`,
        eventDate: eventData?.event_date || "",
        paymentType,
        amount: Number(amount),
      }),
    });

    const mailResult = await mailResponse.json();

    if (mailResult?.success) {
      await supabase.from("notifications").insert({
        event_id: eventId,
        type: "email_sent",
        message: `${selectedSeat.seat_code} için bilet maili gönderildi - ${customerEmail.trim()}`,
      });
    } else {
      console.error("mail send failed:", mailResult);
      await supabase.from("notifications").insert({
        event_id: eventId,
        type: "email_sent",
        message: `${selectedSeat.seat_code} için mail gönderimi başarısız oldu - ${customerEmail.trim()}`,
      });
    }
  } catch (mailError) {
    console.error("mail request error:", mailError);
  }

  setIsSubmitting(false);

  await resetForm(false);
  await getSeats();
  await getNotifications();
}

  async function resetForm(shouldUnlock = true) {
    if (shouldUnlock && selectedSeat && selectedSeat.status === "locking") {
      const { error } = await supabase.rpc("unlock_seat", {
        p_event_id: eventId,
        p_seat_id: selectedSeat.id,
      });

      if (error) {
        console.error("unlock_seat error:", error);
      }
    }

    setSelectedSeat(null);
    setCustomerName("");
    setCustomerEmail("");
    setPaymentType("cash");
    setAmount("");
  }

  async function refundSeat(seat: SeatItem) {
    const confirmed = window.confirm(`${seat.seat_code} koltuğunu iade etmek istiyor musun?`);
    if (!confirmed) return;

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("*")
      .eq("seat_id", seat.id)
      .eq("is_refunded", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (saleError || !sale) {
      alert("Aktif satış kaydı bulunamadı.");
      return;
    }

    const { error: refundError } = await supabase
      .from("sales")
      .update({
        is_refunded: true,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", sale.id);

    if (refundError) {
      console.error("refund sale error:", refundError);
      alert("İade işlemi başarısız.");
      return;
    }

    const { error: seatError } = await supabase
      .from("seats")
      .update({
        status: "available",
        locked_by: null,
        locked_at: null,
      })
      .eq("id", seat.id);

    if (seatError) {
      console.error("refund seat error:", seatError);
      alert("Koltuk güncellenemedi.");
      return;
    }

    await supabase.from("notifications").insert({
      event_id: eventId,
      type: "refund",
      message: `${seat.seat_code} koltuğu iade edildi`,
    });

    await getSeats();
    await getNotifications();
  }

 

  const seatMap = useMemo(() => {
    const map = new Map<string, SeatItem>();
    for (const seat of seats) {
      map.set(seat.seat_code, seat);
    }
    return map;
  }, [seats]);

  const soldCount = seats.filter((s) => s.status === "sold").length;
  const lockingCount = seats.filter((s) => s.status === "locking").length;
  const emptyCount = seats.filter((s) => s.status === "available").length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "white",
        padding: "24px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "#111827",
              padding: 20,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              overflowX: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              <StatCard title="Toplam Koltuk" value={String(seats.length)} />
              <StatCard title="Satılan" value={String(soldCount)} color="#f87171" />
              <StatCard title="İşlemde" value={String(lockingCount)} color="#fbbf24" />
              <StatCard title="Boş" value={String(emptyCount)} color="#4ade80" />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: 28,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 90,
                  minWidth: 90,
                  height: 640,
                  borderRadius: 18,
                  background: "linear-gradient(180deg, #475569, #334155)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: "white",
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                  boxShadow: "0 0 18px rgba(148,163,184,0.25)",
                }}
              >
                SAHNE
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 18,
                    flexWrap: "wrap",
                    fontSize: 14,
                    color: "#cbd5e1",
                    marginBottom: 20,
                  }}
                >
                  <Legend color="#22c55e" text="Boş" />
                  <Legend color="#f59e0b" text="İşlemde" />
                  <Legend color="#ef4444" text="Satıldı" />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `50px repeat(${columns.length}, 64px)`,
                    gap: 6,
                    alignItems: "center",
                    width: "max-content",
                    margin: "0 auto",
                  }}
                >
                  <div></div>

                  {columns.map((col) => (
                    <div
                      key={col}
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#cbd5e1",
                        paddingBottom: 6,
                      }}
                    >
                      {col}
                    </div>
                  ))}

                  {Array.from({ length: maxRows }, (_, i) => i + 1).map((row) => (
                    <RowRenderer
                      key={row}
                      row={row}
                      columns={columns}
                      seatMap={seatMap}
                      currentUserName={userName}
                      onSeatClick={handleSeatClick}
                      onRefund={refundSeat}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                background: "#111827",
                padding: 18,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Satış Paneli</h3>

              {selectedSeat ? (
                <>
                  <p>
                    Seçilen koltuk: <strong>{selectedSeat.seat_code}</strong>
                  </p>

                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Müşteri adı"
                    style={inputStyle}
                  />

                  <input
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Müşteri e-postası"
                    style={inputStyle}
                  />

                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Tutar"
                    type="number"
                    style={inputStyle}
                  />

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button
                      onClick={() => setPaymentType("cash")}
                      style={paymentType === "cash" ? activeBtn : passiveBtn}
                    >
                      Nakit
                    </button>

                    <button
                      onClick={() => setPaymentType("iban")}
                      style={paymentType === "iban" ? activeBtn : passiveBtn}
                    >
                      IBAN
                    </button>
                  </div>

                  {paymentType === "iban" && (
                    <div
                      style={{
                        background: "#0f172a",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 12,
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      <div>
                        <strong>Banka:</strong> {ibanInfo.bank_name}
                      </div>
                      <div>
                        <strong>Alıcı:</strong> {ibanInfo.iban_name}
                      </div>
                      <div>
                        <strong>IBAN:</strong> {ibanInfo.iban_number}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={completeSale}
                    style={mainButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Kaydediliyor..." : "Satışı Tamamla"}
                  </button>

                  <button onClick={() => resetForm(true)} style={secondaryButton}>
                    Vazgeç
                  </button>
                </>
              ) : (
                <p style={{ color: "#cbd5e1" }}>
                  Satış başlatmak için boş bir koltuğa tıkla.
                </p>
              )}
            </div>

            <RevenueCard eventId={eventId} />

            <div
              style={{
                background: "#111827",
                padding: 18,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Bildirimler</h3>

              <div style={{ display: "grid", gap: 10 }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      background: "#0f172a",
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 14,
                    }}
                  >
                    {n.message}
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div
                    style={{
                      background: "#0f172a",
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 14,
                      color: "#94a3b8",
                    }}
                  >
                    Henüz bildirim yok.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function RowRenderer({
  row,
  columns,
  seatMap,
  currentUserName,
  onSeatClick,
  onRefund,
}: {
  row: number;
  columns: string[];
  seatMap: Map<string, SeatItem>;
  currentUserName: string;
  onSeatClick: (seat: SeatItem) => void;
  onRefund: (seat: SeatItem) => void;
}) {
  return (
    <>
      <div
        style={{
          textAlign: "center",
          color: "#94a3b8",
          fontWeight: 700,
        }}
      >
        {row}
      </div>

      {columns.map((col) => {
        const code = `${col}${row}`;
        const seat = seatMap.get(code);

        if (!seat) {
          return <div key={code} style={{ width: 64, height: 42 }} />;
        }

        const isSold = seat.status === "sold";
        const isLocking = seat.status === "locking";
        const isMine = isLocking && seat.locked_by === currentUserName;

        return (
          <button
            key={code}
            onClick={() => {
              if (isSold) {
                onRefund(seat);
                return;
              }

              if (!isLocking) {
                onSeatClick(seat);
              }
            }}
            style={{
              width: 64,
              height: 42,
              border: isMine ? "2px solid #fde68a" : "1px solid #0f172a",
              borderRadius: 6,
              background: isSold ? "#ef4444" : isLocking ? "#f59e0b" : "#22c55e",
              color: "#001018",
              fontWeight: 700,
              cursor: isSold ? "pointer" : isLocking ? "not-allowed" : "pointer",
              opacity: isLocking && !isMine ? 0.85 : 1,
            }}
            title={
              isSold
                ? "İade etmek için tıkla"
                : isLocking
                ? isMine
                  ? "Bu koltuk sende işlemde"
                  : "Bu koltuk başka bir kullanıcıda işlemde"
                : "Satış için tıkla"
            }
          >
            {seat.seat_code}
          </button>
        );
      })}
    </>
  );
}

function RevenueCard({ eventId }: { eventId: number }) {
  const [total, setTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [ibanTotal, setIbanTotal] = useState(0);

  useEffect(() => {
    getRevenue();

    const channel = supabase
      .channel(`sales-room-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          getRevenue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function getRevenue() {
    const { data, error } = await supabase
      .from("sales")
      .select("amount,payment_type")
      .eq("event_id", eventId)
      .eq("is_refunded", false);

    if (error) {
      console.error("getRevenue error:", error);
      return;
    }

    const rows = (data as SaleRow[]) || [];

    const totalRevenue = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const cash = rows
      .filter((r) => r.payment_type === "cash")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const iban = rows
      .filter((r) => r.payment_type === "iban")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    setTotal(totalRevenue);
    setCashTotal(cash);
    setIbanTotal(iban);
  }

  return (
    <div
      style={{
        background: "#111827",
        padding: 18,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Gelir Özeti</h3>

      <div style={{ display: "grid", gap: 8 }}>
        <div>
          Toplam: <strong>{total} ₺</strong>
        </div>
        <div>
          Nakit: <strong>{cashTotal} ₺</strong>
        </div>
        <div>
          IBAN: <strong>{ibanTotal} ₺</strong>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color = "white",
}: {
  title: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#0f172a",
        padding: "14px 18px",
        borderRadius: 14,
        minWidth: 120,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 16,
          height: 16,
          background: color,
          borderRadius: 4,
          display: "inline-block",
        }}
      />
      {text}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0f172a",
  color: "white",
  marginBottom: 12,
};

const mainButton: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 10,
  border: "none",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 10,
};

const secondaryButton: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 10,
  border: "none",
  background: "#334155",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const activeBtn: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  borderRadius: 10,
  border: "none",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer",
};

const passiveBtn: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  borderRadius: 10,
  border: "none",
  background: "#334155",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const userButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};