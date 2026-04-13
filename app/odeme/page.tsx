"use client";

import { useSearchParams } from "next/navigation";

export default function OdemePage() {
  const searchParams = useSearchParams();

  const bank = searchParams.get("bank") || "";
  const receiver = searchParams.get("receiver") || "";
  const iban = searchParams.get("iban") || "";
  const desc = searchParams.get("desc") || "";
  const amount = searchParams.get("amount") || "";

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    alert("Kopyalandı");
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Ödeme Bilgileri</h1>

      <p><b>Banka:</b> {bank}</p>
      <p><b>Alıcı:</b> {receiver}</p>
      <p><b>IBAN:</b> {iban}</p>
      <p><b>Açıklama:</b> {desc}</p>
      <p><b>Tutar:</b> {amount} ₺</p>

      <button onClick={() => copy(iban)}>IBAN Kopyala</button>
      <button onClick={() => copy(desc)}>Açıklama Kopyala</button>
    </main>
  );
}