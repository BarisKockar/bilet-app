"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStoredUserName, setStoredUserName } from "../../../lib/auth-storage";
import { supabase } from "../../../lib/supabase";
import { useIsMobile } from "../../../lib/use-is-mobile";

type SeatItem = {
  id: number;
  event_id: number;
  seat_code: string;
  row_no: string;
  seat_no: number;
  status: "available" | "locking" | "sold";
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
  id: number;
  amount: number;
  payment_type: "cash" | "iban";
  customer_name?: string;
  customer_email?: string;
};

type EventRow = {
  id: number;
  title?: string;
  event_date?: string;
};

const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const maxRows = 20;
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

export default function Page() {
  const params = useParams();
  const eventId = Number(params.id);
  const isMobile = useIsMobile();

  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SeatItem[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "iban">("cash");
  const [amount, setAmount] = useState("");
  const [userName, setUserName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [refundSeatItem, setRefundSeatItem] = useState<SeatItem | null>(null);
  const [refundSale, setRefundSale] = useState<SaleRow | null>(null);
  const [refundConfirmText, setRefundConfirmText] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [ibanInfo, setIbanInfo] = useState<SettingsItem>({
    bank_name: "",
    iban_name: "",
    iban_number: "",
  });

  useEffect(() => {
    const savedName = getStoredUserName();

    if (savedName) {
      setUserName(savedName);
      return;
    }

    const name = window.prompt("Kullanıcı adını gir");
    if (name && name.trim()) {
      const nextUserName = name.trim();
      setStoredUserName(nextUserName);
      setUserName(nextUserName);
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;

    void getSeats();
    void getNotifications();
    void getSettings();
    void clearExpiredLocks();
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
          void getSeats();
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
          void getNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(seatChannel);
      void supabase.removeChannel(notificationChannel);
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const interval = setInterval(() => {
      void getSeats();
      void getNotifications();
    }, 2000);

    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const interval = setInterval(() => {
      void clearExpiredLocks();
      void getSeats();
    }, 15000);

    return () => clearInterval(interval);
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

  async function clearExpiredLocks() {
    const expireBefore = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();

    const { error } = await supabase
      .from("seats")
      .update({
        status: "available",
        locked_by: null,
        locked_at: null,
      })
      .eq("event_id", eventId)
      .eq("status", "locking")
      .lt("locked_at", expireBefore);

    if (error) {
      console.error("clearExpiredLocks error:", error);
    }
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

  async function lockSeatById(seatId: number) {
    return supabase.rpc("lock_seat", {
      p_event_id: eventId,
      p_seat_id: seatId,
      p_user_name: userName,
    });
  }

  async function unlockSeatById(seatId: number) {
    return supabase.rpc("unlock_seat", {
      p_event_id: eventId,
      p_seat_id: seatId,
    });
  }

  async function getEventDetails() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error) {
      console.error("event fetch error:", error);
    }

    return data as EventRow | null;
  }

  async function createNotification(type: string, message: string) {
    await supabase.from("notifications").insert({
      event_id: eventId,
      type,
      message,
    });
  }

  async function sendTicketEmail(params: {
    customerName: string;
    customerEmail: string;
    seatCode: string;
    eventTitle: string;
    eventDate: string;
    paymentType: "cash" | "iban";
    amount: number;
  }) {
    return fetch("/api/send-ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  }

  async function changeUserName() {
    await resetForm(true);

    const name = window.prompt("Yeni kullanıcı adı gir", userName || "");
    if (!name || !name.trim()) return;

    const nextUserName = name.trim();
    setStoredUserName(nextUserName);
    setUserName(nextUserName);

    await getSeats();
  }

  async function handleSeatClick(seat: SeatItem) {
    if (!userName) {
      alert("Önce kullanıcı adı tanımlanmalı.");
      return;
    }

    if (seat.status === "sold") return;

    const isLockedByAnotherUser =
      seat.status === "locking" &&
      seat.locked_by &&
      seat.locked_by !== userName;

    if (isLockedByAnotherUser) {
      alert("Bu koltuk başka bir kullanıcı tarafından işlemde.");
      return;
    }

    if (isMultiSelectMode) {
      const alreadySelected = selectedSeats.some((s) => s.id === seat.id);

      if (alreadySelected) {
        const { error: unlockError } = await unlockSeatById(seat.id);

        if (unlockError) {
          console.error("unlock_seat error:", unlockError);
          return;
        }

        setSelectedSeats((prev) => prev.filter((s) => s.id !== seat.id));
        await getSeats();
        return;
      }

      const { data, error } = await lockSeatById(seat.id);

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

      setSelectedSeats((prev) => [
        ...prev,
        {
          ...seat,
          status: "locking",
          locked_by: userName,
        },
      ]);

      await getSeats();
      return;
    }

    const isSameSelectedSeat = selectedSeat?.id === seat.id;
    if (isSameSelectedSeat) return;

    if (
      selectedSeat &&
      selectedSeat.id !== seat.id &&
      selectedSeat.status === "locking"
    ) {
      const { error: unlockError } = await unlockSeatById(selectedSeat.id);

      if (unlockError) {
        console.error("previous unlock_seat error:", unlockError);
        alert("Önceki koltuk bırakılamadı.");
        return;
      }
    }

    const { data, error } = await lockSeatById(seat.id);

    if (error) {
      console.error("lock_seat error:", error);
      alert("Koltuk kilitlenemedi.");
      await getSeats();
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

    await getSeats();
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

    const eventData = await getEventDetails();

    try {
      const mailResponse = await sendTicketEmail({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        seatCode: selectedSeat.seat_code,
        eventTitle: eventData?.title || `Etkinlik ${eventId}`,
        eventDate: eventData?.event_date || "",
        paymentType,
        amount: Number(amount),
      });

      const mailResult = await mailResponse.json();

      if (mailResult?.success) {
        await createNotification(
          "email_sent",
          `${selectedSeat.seat_code} için bilet maili gönderildi - ${customerEmail.trim()}`
        );
      } else {
        console.error("mail send failed:", mailResult);
        await createNotification(
          "email_sent",
          `${selectedSeat.seat_code} için mail gönderimi başarısız oldu - ${customerEmail.trim()}`
        );
      }
    } catch (mailError) {
      console.error("mail request error:", mailError);
    }

    setIsSubmitting(false);

    await resetForm(false);
    await getSeats();
    await getNotifications();
  }

  async function completeMultiSale() {
    if (selectedSeats.length === 0) return;

    if (!customerName.trim() || !customerEmail.trim() || !amount) {
      alert("Lütfen tüm alanları doldur.");
      return;
    }

    setIsSubmitting(true);

    try {
      for (const seat of selectedSeats) {
        const { data, error } = await supabase.rpc("complete_sale", {
          p_event_id: eventId,
          p_seat_id: seat.id,
          p_customer_name: customerName.trim(),
          p_customer_email: customerEmail.trim(),
          p_payment_type: paymentType,
          p_amount: Number(amount),
        });

        if (error || !data?.success) {
          console.error("complete_multi_sale error:", error || data);
          alert(`${seat.seat_code} için satış tamamlanamadı.`);
          setIsSubmitting(false);
          return;
        }
      }

      const eventData = await getEventDetails();

      try {
        await sendTicketEmail({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          seatCode: selectedSeats.map((s) => s.seat_code).join(", "),
          eventTitle: eventData?.title || `Etkinlik ${eventId}`,
          eventDate: eventData?.event_date || "",
          paymentType,
          amount: Number(amount) * selectedSeats.length,
        });
      } catch (mailError) {
        console.error("multi mail request error:", mailError);
      }

      setIsSubmitting(false);
      await resetForm(false);
      await getSeats();
      await getNotifications();
    } catch (err) {
      console.error("completeMultiSale error:", err);
      setIsSubmitting(false);
      alert("Çoklu satış sırasında hata oluştu.");
    }
  }

  async function resetForm(shouldUnlock = true) {
    if (shouldUnlock && selectedSeat && selectedSeat.status === "locking") {
      const { error } = await unlockSeatById(selectedSeat.id);

      if (error) {
        console.error("unlock_seat error:", error);
      }
    }

    if (shouldUnlock && selectedSeats.length > 0) {
      for (const seat of selectedSeats) {
        const { error } = await unlockSeatById(seat.id);

        if (error) {
          console.error("multi unlock_seat error:", error);
        }
      }
    }

    setSelectedSeat(null);
    setSelectedSeats([]);
    setCustomerName("");
    setCustomerEmail("");
    setPaymentType("cash");
    setAmount("");
    setIsMultiSelectMode(false);
  }

  async function refundSeat(seat: SeatItem) {
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, amount, payment_type, customer_name, customer_email")
      .eq("seat_id", seat.id)
      .eq("is_refunded", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (saleError || !sale) {
      alert("Aktif satış kaydı bulunamadı.");
      return;
    }

    setRefundSeatItem(seat);
    setRefundSale(sale as SaleRow);
    setRefundConfirmText("");
  }

  async function confirmRefund() {
    if (!refundSeatItem || !refundSale) return;

    if (refundConfirmText.trim().toUpperCase() !== "IADE") {
      alert('İade için kutuya "IADE" yazmalısın.');
      return;
    }

    setRefundLoading(true);

    const { error: refundError } = await supabase
      .from("sales")
      .update({
        is_refunded: true,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", refundSale.id);

    if (refundError) {
      console.error("refund sale error:", refundError);
      setRefundLoading(false);
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
      .eq("id", refundSeatItem.id);

    if (seatError) {
      console.error("refund seat error:", seatError);
      setRefundLoading(false);
      alert("Koltuk güncellenemedi.");
      return;
    }

    await createNotification("refund", `${refundSeatItem.seat_code} koltuğu iade edildi`);

    setRefundLoading(false);
    setRefundSeatItem(null);
    setRefundSale(null);
    setRefundConfirmText("");

    await getSeats();
    await getNotifications();
  }

  function closeRefundModal() {
    setRefundSeatItem(null);
    setRefundSale(null);
    setRefundConfirmText("");
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

  const seatWidth = isMobile ? 42 : 64;
  const seatHeight = isMobile ? 34 : 42;
  const labelWidth = isMobile ? 32 : 50;

  return (
    <main
      className="theater-shell"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(214,166,79,0.1), transparent 24%), linear-gradient(180deg, #0f172a 0%, #0b1020 100%)",
        color: "white",
        padding: isMobile ? "16px 10px" : "24px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {refundSeatItem && refundSale && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 10 : 16,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : 460,
              background: "#111827",
              borderRadius: 18,
              padding: isMobile ? 16 : 20,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12, color: "#fca5a5" }}>
              İade Onayı
            </h3>

            <div style={{ display: "grid", gap: 8, marginBottom: 16, color: "#e5e7eb" }}>
              <div>
                <strong>Koltuk:</strong> {refundSeatItem.seat_code}
              </div>
              <div>
                <strong>Müşteri:</strong> {refundSale.customer_name || "-"}
              </div>
              <div>
                <strong>E-posta:</strong> {refundSale.customer_email || "-"}
              </div>
              <div>
                <strong>Tutar:</strong> {refundSale.amount} ₺
              </div>
              <div>
                <strong>Ödeme:</strong> {refundSale.payment_type === "cash" ? "Nakit" : "IBAN"}
              </div>
            </div>

            <p style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 10 }}>
              Yanlış iade yapılmasını önlemek için aşağıya <strong>IADE</strong> yaz.
            </p>

            <input
              value={refundConfirmText}
              onChange={(e) => setRefundConfirmText(e.target.value)}
              placeholder='Onay için "IADE" yaz'
              style={inputStyle}
            />

            <div
              style={{
                display: "flex",
                gap: 10,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <button
                onClick={confirmRefund}
                disabled={refundLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {refundLoading ? "İade ediliyor..." : "İadeyi Onayla"}
              </button>

              <button
                onClick={closeRefundModal}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#334155",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div
          className="theater-panel-strong theater-curtain theater-stage-top"
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            borderRadius: 28,
            padding: isMobile ? 16 : 20,
          }}
        >
          <Link href="/" className="theater-link">
            ← Günlere dön
          </Link>

          <button
            onClick={changeUserName}
            style={{ ...userButtonStyle, width: isMobile ? "100%" : "auto" }}
          >
            Kullanıcı: {userName || "Tanımsız"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div
            className="theater-panel-strong"
            style={{
              padding: isMobile ? 12 : 20,
              borderRadius: 24,
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
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: isMobile ? "flex-start" : "center",
                gap: isMobile ? 16 : 28,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: isMobile ? "100%" : 90,
                  minWidth: isMobile ? "100%" : 90,
                  height: isMobile ? 56 : 640,
                  borderRadius: 18,
                  background: "linear-gradient(180deg, #475569, #334155)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: "white",
                  writingMode: isMobile ? "horizontal-tb" : "vertical-rl",
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
                    width: "100%",
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `${labelWidth}px repeat(${columns.length}, ${seatWidth}px)`,
                      gap: isMobile ? 4 : 6,
                      alignItems: "center",
                      width: "max-content",
                      margin: 0,
                      minWidth: "max-content",
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
                          fontSize: isMobile ? 11 : 14,
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
                        seatWidth={seatWidth}
                        seatHeight={seatHeight}
                        labelWidth={labelWidth}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div
              className="theater-panel"
              style={{
                padding: isMobile ? 14 : 18,
                borderRadius: 22,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Satış Paneli</h3>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 12,
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                <button
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedSeats([]);
                  }}
                  style={!isMultiSelectMode ? activeBtn : passiveBtn}
                >
                  Tekli Satış
                </button>

                <button
                  onClick={() => {
                    setSelectedSeat(null);
                    setIsMultiSelectMode(true);
                  }}
                  style={isMultiSelectMode ? activeBtn : passiveBtn}
                >
                  Çoklu Satış
                </button>
              </div>

              {selectedSeat || selectedSeats.length > 0 ? (
                <>
                  {!isMultiSelectMode ? (
                    <p>
                      Seçilen koltuk: <strong>{selectedSeat?.seat_code}</strong>
                    </p>
                  ) : (
                    <p>
                      Seçilen koltuklar:{" "}
                      <strong>{selectedSeats.map((s) => s.seat_code).join(", ")}</strong>
                    </p>
                  )}

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
                    placeholder={isMultiSelectMode ? "Koltuk başı tutar" : "Tutar"}
                    type="number"
                    style={inputStyle}
                  />

                  {isMultiSelectMode && (
                    <div
                      style={{
                        background: "#0f172a",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 12,
                        fontSize: 14,
                      }}
                    >
                      Toplam tahsilat:{" "}
                      <strong>{Number(amount || 0) * selectedSeats.length} ₺</strong>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 12,
                      flexDirection: isMobile ? "column" : "row",
                    }}
                  >
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



                  <button
                    onClick={isMultiSelectMode ? completeMultiSale : completeSale}
                    style={mainButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Kaydediliyor..."
                      : isMultiSelectMode
                        ? `Toplu Satışı Tamamla (${selectedSeats.length})`
                        : "Satışı Tamamla"}
                  </button>

                  <button onClick={() => void resetForm(true)} style={secondaryButton}>
                    Vazgeç
                  </button>
                </>
              ) : (
                <p style={{ color: "#cbd5e1" }}>
                  {isMultiSelectMode
                    ? "Çoklu satış için boş koltukları seç."
                    : "Satış başlatmak için boş bir koltuğa tıkla."}
                </p>
              )}
            </div>

            <RevenueCard eventId={eventId} />

            <div
              className="theater-panel"
              style={{
                padding: isMobile ? 14 : 18,
                borderRadius: 22,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Bildirimler</h3>
              {paymentType === "iban" && (
                <div
                  style={{
                    background: "#0f172a",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 12,
                    fontSize: 14,
                    lineHeight: 1.6,
                    textAlign: "center",
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <strong>Banka:</strong> {ibanInfo.bank_name}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <strong>Alıcı:</strong> {ibanInfo.iban_name}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <strong>IBAN:</strong> {ibanInfo.iban_number}
                  </div>
                </div>
              )}
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
  seatWidth,
  seatHeight,
  labelWidth,
}: {
  row: number;
  columns: string[];
  seatMap: Map<string, SeatItem>;
  currentUserName: string;
  onSeatClick: (seat: SeatItem) => void;
  onRefund: (seat: SeatItem) => void;
  seatWidth: number;
  seatHeight: number;
  labelWidth: number;
}) {
  return (
    <>
      <div
        style={{
          width: labelWidth,
          textAlign: "center",
          color: "#94a3b8",
          fontWeight: 700,
          fontSize: seatWidth < 50 ? 11 : 14,
        }}
      >
        {row}
      </div>

      {columns.map((col) => {
        const code = `${col}${row}`;
        const seat = seatMap.get(code);

        if (!seat) {
          return <div key={code} style={{ width: seatWidth, height: seatHeight }} />;
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

              if (!isLocking || isMine) {
                onSeatClick(seat);
              }
            }}
            style={{
              width: seatWidth,
              height: seatHeight,
              border: isMine ? "2px solid #fde68a" : "1px solid #0f172a",
              borderRadius: 6,
              background: isSold ? "#ef4444" : isLocking ? "#f59e0b" : "#22c55e",
              color: "#001018",
              fontWeight: 700,
              fontSize: seatWidth < 50 ? 10 : 12,
              cursor: isSold ? "pointer" : isLocking && !isMine ? "not-allowed" : "pointer",
              opacity: isLocking && !isMine ? 0.85 : 1,
              padding: 0,
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
    void getRevenue();

    const channel = supabase
      .channel(`sales-room-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void getRevenue();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void getRevenue();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      void getRevenue();
    }, 2000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [eventId]);

  async function getRevenue() {
    const { data, error } = await supabase
      .from("sales")
      .select("id, amount, payment_type")
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
