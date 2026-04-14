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

  const paymentDetails = [
    { label: "Banka", value: bank || "-" },
    { label: "Alıcı", value: receiver || "-" },
    { label: "IBAN", value: iban || "-" },
    { label: "Açıklama", value: desc || "-" },
    { label: "Tutar", value: amount ? `${amount} ₺` : "-" },
  ];

  const copyButtons = [
    { value: iban, label: "IBAN’ı Kopyala" },
    { value: receiver, label: "Alıcıyı Kopyala" },
    { value: desc, label: "Açıklamayı Kopyala" },
    { value: amount, label: "Tutarı Kopyala" },
  ];

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
          {paymentDetails.map((item) => (
            <div key={item.label}>
              <strong>{item.label}:</strong> {item.value}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {copyButtons.map((button) => (
            <CopyButton key={button.label} value={button.value} label={button.label} />
          ))}
        </div>
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
