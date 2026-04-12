import { NextResponse } from "next/server";
import { Resend } from "resend";
import fs from "node:fs";
import path from "node:path";

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

    let attachments: {
      filename: string;
      content: Buffer;
      contentType: string;
    }[] = [];

    if (fs.existsSync(posterPath)) {
      const posterBuffer = fs.readFileSync(posterPath);

      attachments = [
        {
          filename: "afis.jpg",
          content: posterBuffer,
          contentType: "image/jpeg",
        },
      ];
    }

    const result = await resend.emails.send({
      from: process.env.MAIL_FROM || "onboarding@resend.dev",
      to: customerEmail,
      subject: `Biletiniz Hazır - ${eventTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #111;">
          <h2 style="margin-bottom: 16px;">Biletiniz Hazır</h2>
          <p>Merhaba <strong>${customerName}</strong>,</p>
          <p>Bilet bilgileriniz aşağıdadır:</p>

          <div style="margin-top: 16px; padding: 16px; border: 1px solid #ddd; border-radius: 12px;">
            <p><strong>Etkinlik:</strong> ${eventTitle}</p>
            <p><strong>Tarih:</strong> ${eventDate}</p>
            <p><strong>Koltuk:</strong> ${seatCode}</p>
            <p><strong>Ödeme Türü:</strong> ${paymentType === "cash" ? "Nakit" : "IBAN"}</p>
            <p><strong>Tutar:</strong> ${amount} ₺</p>
          </div>

          <p style="margin-top: 18px;">Afiş ektedir. Girişte bu e-postayı gösterebilirsiniz.</p>
          <p>İyi seyirler dileriz.</p>
        </div>
      `,
      attachments,
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