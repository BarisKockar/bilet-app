type SearchParams = {
  bank?: string;
  receiver?: string;
  iban?: string;
  desc?: string;
  amount?: string;
};

function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      alert(`${label} kopyalandı.`);
    } catch (error) {
      console.error(`copy ${label} error:`, error);
      alert(`${label} kopyalanamadı.`);
    }
  }

  return (
    <button onClick={handleCopy} style={btn}>
      {label}
    </button>
  );
}

export default function OdemePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const bank = searchParams.bank || "";
  const receiver = searchParams.receiver || "";
  const iban = searchParams.iban || "";
  const desc = searchParams.desc || "";
  const amount = searchParams.amount || "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "white",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          background: "#111827",
          borderRadius: 20,
          padding: 20,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 16 }}>Ödeme Bilgileri</h1>

        <div
          style={{
            background: "#0f172a",
            borderRadius: 14,
            padding: 16,
            lineHeight: 1.8,
            marginBottom: 16,
          }}
        >
          <div>
            <strong>Banka:</strong> {bank || "-"}
          </div>
          <div>
            <strong>Alıcı:</strong> {receiver || "-"}
          </div>
          <div>
            <strong>IBAN:</strong> {iban || "-"}
          </div>
          <div>
            <strong>Açıklama:</strong> {desc || "-"}
          </div>
          <div>
            <strong>Tutar:</strong> {amount ? `${amount} ₺` : "-"}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <CopyButton value={iban} label="IBAN’ı Kopyala" />
          <CopyButton value={receiver} label="Alıcıyı Kopyala" />
          <CopyButton value={desc} label="Açıklamayı Kopyala" />
          <CopyButton value={amount} label="Tutarı Kopyala" />
        </div>

        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          Kopyaladığın bilgileri mobil bankacılık uygulamana yapıştırarak ödemeyi tamamlayabilirsin.
        </p>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};