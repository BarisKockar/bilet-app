"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AppUser = {
  id: number;
  name: string;
  username: string;
  password: string;
  role: "admin" | "user";
  is_approved: boolean;
  is_active?: boolean;
  created_at: string;
};

type EventItem = {
  id: number;
  title: string;
  event_date: string;
  slug?: string;
};

type SaleItem = {
  id: number;
  event_id: number;
  seat_id: number;
  customer_name: string;
  customer_email: string;
  payment_type: "cash" | "iban";
  amount: number;
  is_refunded: boolean;
  refunded_at?: string | null;
  created_at: string;
};

type AuditLogItem = {
  id: number;
  event_id?: number | null;
  action: string;
  actor?: string | null;
  seat_code?: string | null;
  detail?: string | null;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(false);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [runningReset, setRunningReset] = useState(false);
  const [runningLockClear, setRunningLockClear] = useState(false);
  const [runningSeatBuild, setRunningSeatBuild] = useState(false);

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");

  const [searchText, setSearchText] = useState("");

  const [selectedEventId, setSelectedEventId] = useState("");
  const [seatRows, setSeatRows] = useState("20");
  const [seatColumns, setSeatColumns] = useState("A,B,C,D,E,F,G,H,I,J,K,L");
  const [excludedSeats, setExcludedSeats] = useState("");

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  useEffect(() => {
    const loggedIn = localStorage.getItem("is_logged_in");
    const role = localStorage.getItem("ticket_user_role");

    if (loggedIn !== "true" || role !== "admin") {
      router.push("/login");
      return;
    }

    void Promise.all([getUsers(), getEvents(), getSales(), getLogs()]);
  }, [router]);

  async function getUsers() {
    setLoadingUsers(true);

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getUsers error:", error);
      setLoadingUsers(false);
      return;
    }

    setUsers((data as AppUser[]) || []);
    setLoadingUsers(false);
  }

  async function getEvents() {
    setLoadingEvents(true);

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      console.error("getEvents error:", error);
      setLoadingEvents(false);
      return;
    }

    const rows = (data as EventItem[]) || [];
    setEvents(rows);

    if (!selectedEventId && rows.length > 0) {
      setSelectedEventId(String(rows[0].id));
    }

    setLoadingEvents(false);
  }

  async function getSales() {
    setLoadingSales(true);

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("getSales error:", error);
      setLoadingSales(false);
      return;
    }

    setSales((data as SaleItem[]) || []);
    setLoadingSales(false);
  }

  async function getLogs() {
    setLoadingLogs(true);

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("getLogs error:", error);
      setLogs([]);
      setLoadingLogs(false);
      return;
    }

    setLogs((data as AuditLogItem[]) || []);
    setLoadingLogs(false);
  }

  async function deleteUser(id: number, username: string) {
    const currentUsername = localStorage.getItem("ticket_username");

    if (username === currentUsername) {
      alert("Kendi hesabını buradan silemezsin.");
      return;
    }

    const ok = window.confirm(`${username} kullanıcısını silmek istiyor musun?`);
    if (!ok) return;

    const { error } = await supabase.from("app_users").delete().eq("id", id);

    if (error) {
      console.error("deleteUser error:", error);
      alert("Kullanıcı silinemedi.");
      return;
    }

    await getUsers();
  }

  async function toggleApproval(user: AppUser) {
    const { error } = await supabase
      .from("app_users")
      .update({ is_approved: !user.is_approved })
      .eq("id", user.id);

    if (error) {
      console.error("toggleApproval error:", error);
      alert("Kullanıcı durumu güncellenemedi.");
      return;
    }

    await getUsers();
  }

  async function toggleRole(user: AppUser) {
    const currentUsername = localStorage.getItem("ticket_username");

    if (user.username === currentUsername && user.role === "admin") {
      alert("Kendi admin yetkini buradan kaldıramazsın.");
      return;
    }

    const nextRole = user.role === "admin" ? "user" : "admin";

    const { error } = await supabase
      .from("app_users")
      .update({ role: nextRole })
      .eq("id", user.id);

    if (error) {
      console.error("toggleRole error:", error);
      alert("Rol güncellenemedi.");
      return;
    }

    await getUsers();
  }

  async function createEvent() {
    if (!newEventTitle.trim() || !newEventDate.trim()) {
      alert("Etkinlik adı ve tarih gir.");
      return;
    }

    const slug = newEventTitle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s-]/gi, "")
      .replace(/\s+/g, "-");

    const { error } = await supabase.from("events").insert({
      title: newEventTitle.trim(),
      event_date: newEventDate.trim(),
      slug,
    });

    if (error) {
      console.error("createEvent error:", error);
      alert("Etkinlik eklenemedi.");
      return;
    }

    setNewEventTitle("");
    setNewEventDate("");
    await getEvents();
  }

  async function updateEvent(event: EventItem) {
    const { error } = await supabase
      .from("events")
      .update({
        title: event.title,
        event_date: event.event_date,
      })
      .eq("id", event.id);

    if (error) {
      console.error("updateEvent error:", error);
      alert("Etkinlik güncellenemedi.");
      return;
    }

    await getEvents();
  }

  async function deleteEvent(id: number) {
    const ok = window.confirm("Bu etkinliği silmek istiyor musun?");
    if (!ok) return;

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      console.error("deleteEvent error:", error);
      alert("Etkinlik silinemedi.");
      return;
    }

    await getEvents();
  }

  async function resetAllSystem() {
    const ok = window.confirm(
      "Tüm satışlar, bildirimler ve koltuk durumları sıfırlanacak. Emin misin?"
    );
    if (!ok) return;

    setRunningReset(true);

    const { error: notificationError } = await supabase
      .from("notifications")
      .delete()
      .neq("id", 0);

    const { error: salesError } = await supabase
      .from("sales")
      .delete()
      .neq("id", 0);

    const { error: seatsError } = await supabase
      .from("seats")
      .update({
        status: "available",
        locked_by: null,
        locked_at: null,
      })
      .neq("id", 0);

    setRunningReset(false);

    if (notificationError || salesError || seatsError) {
      console.error({ notificationError, salesError, seatsError });
      alert("Sistem sıfırlanırken hata oluştu.");
      return;
    }

    alert("Sistem sıfırlandı.");
    await Promise.all([getSales(), getLogs()]);
  }

  async function clearAllLocks() {
    const ok = window.confirm("Tüm işlemde kalan sarı koltuklar temizlensin mi?");
    if (!ok) return;

    setRunningLockClear(true);

    const { error } = await supabase
      .from("seats")
      .update({
        status: "available",
        locked_by: null,
        locked_at: null,
      })
      .eq("status", "locking");

    setRunningLockClear(false);

    if (error) {
      console.error("clearAllLocks error:", error);
      alert("Lock temizleme başarısız.");
      return;
    }

    alert("Tüm lock'lar temizlendi.");
  }

  function updateEventField(id: number, field: keyof EventItem, value: string) {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, [field]: value } : event
      )
    );
  }

  function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) {
      alert("İndirilecek veri yok.");
      return;
    }

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header] ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  async function buildSeatPlan() {
    if (!selectedEventId) {
      alert("Önce etkinlik seç.");
      return;
    }

    const parsedRows = Number(seatRows);

    if (!parsedRows || parsedRows < 1) {
      alert("Geçerli sıra sayısı gir.");
      return;
    }

    const parsedColumns = seatColumns
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (parsedColumns.length === 0) {
      alert("En az bir sütun gir.");
      return;
    }

    const parsedExcluded = excludedSeats
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const ok = window.confirm(
      "Bu etkiniğin mevcut koltukları, satışları ve bildirimleri silinip yeni plan oluşturulacak. Emin misin?"
    );
    if (!ok) return;

    setRunningSeatBuild(true);

    const { data, error } = await supabase.rpc("reset_event_seats", {
      p_event_id: Number(selectedEventId),
      p_rows: parsedRows,
      p_columns: parsedColumns,
      p_excluded: parsedExcluded,
    });

    setRunningSeatBuild(false);

    if (error) {
      console.error("buildSeatPlan error:", error);
      alert("Koltuk planı oluşturulamadı.");
      return;
    }

    const insertedCount = (data as { inserted_count?: number } | null)?.inserted_count ?? 0;
    alert(`Koltuk planı oluşturuldu. Eklenen koltuk: ${insertedCount}`);
  }

  const filteredSales = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sales;

    return sales.filter((sale) => {
      return (
        sale.customer_name?.toLowerCase().includes(q) ||
        sale.customer_email?.toLowerCase().includes(q) ||
        String(sale.amount).includes(q) ||
        sale.payment_type?.toLowerCase().includes(q) ||
        String(sale.seat_id).includes(q)
      );
    });
  }, [sales, searchText]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "white",
        padding: isMobile ? 12 : 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            gap: 12,
            flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 32 }}>Admin Paneli</h1>
            <p style={{ color: "#cbd5e1" }}>
              Kullanıcılar, etkinlikler, satışlar, loglar ve koltuk planı yönetimi
            </p>
          </div>

          <button
            onClick={() => router.push("/")}
            style={{ ...secondaryBtn, width: isMobile ? "100%" : "auto" }}
          >
            Ana Sayfa
          </button>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Sistem İşlemleri</h2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
              <button
                onClick={resetAllSystem}
                style={{ ...dangerBtn, width: isMobile ? "100%" : "auto" }}
                disabled={runningReset}
              >
                {runningReset ? "Sıfırlanıyor..." : "Tüm Satışları ve Bildirimleri Sıfırla"}
              </button>

              <button
                onClick={clearAllLocks}
                style={{ ...warnBtn, width: isMobile ? "100%" : "auto" }}
                disabled={runningLockClear}
              >
                {runningLockClear ? "Temizleniyor..." : "Tüm Lock'ları Temizle"}
              </button>

              <button
                onClick={() =>
                  downloadCsv(
                    "sales.csv",
                    sales.map((s) => ({
                      id: s.id,
                      event_id: s.event_id,
                      seat_id: s.seat_id,
                      customer_name: s.customer_name,
                      customer_email: s.customer_email,
                      payment_type: s.payment_type,
                      amount: s.amount,
                      is_refunded: s.is_refunded,
                      created_at: s.created_at,
                    }))
                  )
                }
                style={{ ...secondaryBtn, width: isMobile ? "100%" : "auto" }}
              >
                Satışları CSV İndir
              </button>

              <button
                onClick={() =>
                  downloadCsv(
                    "users.csv",
                    users.map((u) => ({
                      id: u.id,
                      name: u.name,
                      username: u.username,
                      role: u.role,
                      is_approved: u.is_approved,
                      is_active: u.is_active,
                      created_at: u.created_at,
                    }))
                  )
                }
                style={{ ...secondaryBtn, width: isMobile ? "100%" : "auto" }}
              >
                Kullanıcıları CSV İndir
              </button>

              <button
                onClick={() =>
                  downloadCsv(
                    "audit_logs.csv",
                    logs.map((l) => ({
                      id: l.id,
                      event_id: l.event_id,
                      action: l.action,
                      actor: l.actor,
                      seat_code: l.seat_code,
                      detail: l.detail,
                      created_at: l.created_at,
                    }))
                  )
                }
                style={{ ...secondaryBtn, width: isMobile ? "100%" : "auto" }}
              >
                Logları CSV İndir
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Kullanıcılar</h2>

            {loadingUsers ? (
              <p>Yükleniyor...</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {users.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      ...rowCardStyle,
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{user.name}</div>
                      <div>Kullanıcı adı: {user.username}</div>
                      <div>Rol: {user.role}</div>
                      <div>Durum: {user.is_approved ? "Onaylı" : "Kapalı"}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        Oluşturulma: {user.created_at}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
                      <button onClick={() => toggleApproval(user)} style={{ ...warnBtn, width: isMobile ? "100%" : "auto" }}>
                        {user.is_approved ? "Erişimi Kapat" : "Erişimi Aç"}
                      </button>

                      <button onClick={() => toggleRole(user)} style={{ ...roleBtn, width: isMobile ? "100%" : "auto" }}>
                        {user.role === "admin" ? "User Yap" : "Admin Yap"}
                      </button>

                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        style={{ ...dangerBtnSmall, width: isMobile ? "100%" : "auto" }}
                      >
                        Kullanıcıyı Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Etkinlik Yönetimi</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr auto",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <input
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="Yeni etkinlik adı"
                style={inputStyle}
              />
              <input
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                placeholder="2026-04-20"
                style={inputStyle}
              />
              <button onClick={createEvent} style={primaryBtn}>
                Ekle
              </button>
            </div>

            {loadingEvents ? (
              <p>Yükleniyor...</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {events.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      ...rowCardStyle,
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                    }}
                  >
                    <div style={{ flex: 1, display: "grid", gap: 8 }}>
                      <input
                        value={event.title}
                        onChange={(e) =>
                          updateEventField(event.id, "title", e.target.value)
                        }
                        style={inputStyle}
                      />
                      <input
                        value={event.event_date}
                        onChange={(e) =>
                          updateEventField(event.id, "event_date", e.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
                      <button onClick={() => updateEvent(event)} style={{ ...primaryBtn, width: isMobile ? "100%" : "auto" }}>
                        Kaydet
                      </button>

                      <button
                        onClick={() => deleteEvent(event.id)}
                        style={{ ...dangerBtnSmall, width: isMobile ? "100%" : "auto" }}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Koltuk Düzeni Oluştur</h2>

            <div style={{ display: "grid", gap: 12 }}>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Etkinlik seç</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {event.event_date}
                  </option>
                ))}
              </select>

              <input
                value={seatRows}
                onChange={(e) => setSeatRows(e.target.value)}
                placeholder="Sıra sayısı (ör: 20)"
                style={inputStyle}
              />

              <input
                value={seatColumns}
                onChange={(e) => setSeatColumns(e.target.value)}
                placeholder="Sütunlar (ör: A,B,C,D,E,F,G,H,I,J,K,L)"
                style={inputStyle}
              />

              <textarea
                value={excludedSeats}
                onChange={(e) => setExcludedSeats(e.target.value)}
                placeholder="Hariç koltuklar (ör: C1,C2,F5,G5)"
                style={{
                  ...inputStyle,
                  minHeight: 90,
                  resize: "vertical",
                }}
              />

              <div style={{ color: "#94a3b8", fontSize: 14 }}>
                Bu işlem seçilen etkinliğin mevcut koltuklarını, satışlarını ve bildirimlerini silip yeni plan oluşturur.
              </div>

              <button
                onClick={buildSeatPlan}
                style={primaryBtn}
                disabled={runningSeatBuild}
              >
                {runningSeatBuild ? "Oluşturuluyor..." : "Koltuk Planını Oluştur / Yeniden Kur"}
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Satış Geçmişi</h2>

            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Müşteri, mail, tutar, ödeme tipi ara"
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            {loadingSales ? (
              <p>Yükleniyor...</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    style={{
                      ...rowCardStyle,
                      flexDirection: "column",
                      alignItems: "stretch",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {sale.customer_name || "-"}
                      </div>
                      <div>E-posta: {sale.customer_email || "-"}</div>
                      <div>Koltuk ID: {sale.seat_id}</div>
                      <div>Etkinlik ID: {sale.event_id}</div>
                      <div>Ödeme: {sale.payment_type}</div>
                      <div>Tutar: {sale.amount} ₺</div>
                      <div>Durum: {sale.is_refunded ? "İade edildi" : "Aktif"}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        Satış: {sale.created_at}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredSales.length === 0 && (
                  <div style={emptyBoxStyle}>Kayıt bulunamadı.</div>
                )}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Audit Log</h2>

            {loadingLogs ? (
              <p>Yükleniyor...</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      ...rowCardStyle,
                      flexDirection: "column",
                      alignItems: "stretch",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {log.action.toUpperCase()}
                      </div>
                      <div>Aktör: {log.actor || "-"}</div>
                      <div>Koltuk: {log.seat_code || "-"}</div>
                      <div>Detay: {log.detail || "-"}</div>
                      <div>Etkinlik ID: {log.event_id ?? "-"}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        {log.created_at}
                      </div>
                    </div>
                  </div>
                ))}

                {logs.length === 0 && (
                  <div style={emptyBoxStyle}>Log bulunamadı.</div>
                )}
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

const rowCardStyle: React.CSSProperties = {
  background: "#0f172a",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const emptyBoxStyle: React.CSSProperties = {
  background: "#0f172a",
  borderRadius: 12,
  padding: 12,
  color: "#94a3b8",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "white",
  outline: "none",
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

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
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

const roleBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "none",
  background: "#10b981",
  color: "#052e16",
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