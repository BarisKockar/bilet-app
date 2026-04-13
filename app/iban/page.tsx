export default function IbanPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "white",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#111827",
          borderRadius: 18,
          padding: 20,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>IBAN Bilgileri</h1>

        <div style={{ lineHeight: 1.8 }}>
          <div><strong>Banka:</strong> Ziraat Bankası</div>
          <div><strong>Alıcı:</strong> FATMA PELİN ZAİM</div>
          <div><strong>IBAN:</strong> TR62 0006 4000 0014 3790 2346 55</div>
          <div><strong>Açıklama:</strong> Bilet ödemesi</div>
        </div>
      </div>
    </main>
  );
}