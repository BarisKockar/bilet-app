import { NextResponse } from "next/server";
import { Resend } from "resend";
import fs from "node:fs";
import path from "node:path";
console.log("RESEND_API_KEY var mı:", !!process.env.RESEND_API_KEY);
console.log("MAIL_FROM:", process.env.MAIL_FROM);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      customerName,
      customerEmail,
      seatCode,
      eventTitle,
      eventDate,
      paymentType,
      amount,
    } = body;

    const posterPath = path.join(process.cwd(), "public", "afis.jpg");
    const posterBuffer = fs.readFileSync(posterPath);

    const result = await resend.emails.send({
      from: process.env.MAIL_FROM || "onboarding@resend.dev",
      to: customerEmail,
      subject: `Biletiniz Hazır - ${eventTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #111;">
          <img
            src="cid:poster-image"
            alt="Afiş"
            style="width: 100%; max-width: 520px; border-radius: 16px; display: block; margin-bottom: 20px;"
          />

          <h2 style="margin-bottom: 16px;">Biletiniz Hazır</h2>
          <p>Merhaba <strong>${customerName}</strong>,</p>

          <div style="margin-top: 16px; padding: 16px; border: 1px solid #ddd; border-radius: 12px;">
            <p><strong>Etkinlik:</strong> ${eventTitle}</p>
            <p><strong>Tarih:</strong> ${eventDate}</p>
            <p><strong>Koltuk:</strong> ${seatCode}</p>
            <p><strong>Ödeme Türü:</strong> ${paymentType === "cash" ? "Nakit" : "IBAN"}</p>
            <p><strong>Tutar:</strong> ${amount} ₺</p>
          </div>

          <p style="margin-top: 18px;">Girişte bu e-postayı gösterebilirsiniz.</p>
        </div>
      `,
      attachments: [
        {
          filename: "afis.jpg",
          content: posterBuffer,
          contentType: "image/jpeg",
          contentId: "poster-image",
        },
      ],
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("send-ticket error:", error);
    return NextResponse.json(
      { success: false, message: "Mail gönderimi başarısız." },
      { status: 500 }
    );
  }
}