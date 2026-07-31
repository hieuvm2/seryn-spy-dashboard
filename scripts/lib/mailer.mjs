/* ============================================================
   mailer — gửi email kèm tệp đính kèm. Hai đường:
     REPORT_MAIL_PROVIDER=smtp   -> nodemailer (Google Workspace / SMTP bất kỳ)
     REPORT_MAIL_PROVIDER=resend -> HTTP API Resend (chỉ cần 1 API key)
   Chưa cấu hình -> mailerConfigured() = false, script gọi sẽ bỏ qua bước gửi.
   KHÔNG bao giờ in giá trị mật khẩu / API key ra log.
   ============================================================ */

const env = (k, d = "") => String(process.env[k] ?? d).trim();

/** Danh sách email, ngăn cách bằng dấu phẩy (giống ADS_SOURCE_API_KEY). */
export function parseRecipients(v) {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

export function mailProvider() {
  return (env("REPORT_MAIL_PROVIDER") || "smtp").toLowerCase();
}

/** Đã đủ thông tin để gửi chưa. */
export function mailerConfigured() {
  if (mailProvider() === "resend") return !!env("REPORT_MAIL_API_KEY");
  return !!env("REPORT_MAIL_SMTP_HOST") && !!env("REPORT_MAIL_SMTP_USER") && !!env("REPORT_MAIL_SMTP_PASS");
}

/** Mô tả cấu hình đang thiếu — để script in hướng dẫn, không lộ giá trị. */
export function missingMailConfig() {
  const need = mailProvider() === "resend"
    ? ["REPORT_MAIL_API_KEY"]
    : ["REPORT_MAIL_SMTP_HOST", "REPORT_MAIL_SMTP_USER", "REPORT_MAIL_SMTP_PASS"];
  return need.filter((k) => !env(k));
}

/**
 * Gửi 1 email.
 * @param {{to: string[], subject: string, html: string, text?: string,
 *          attachments?: Array<{filename: string, content: Buffer, contentType?: string}>}} msg
 */
export async function sendMail(msg) {
  const to = (msg.to || []).filter(Boolean);
  if (!to.length) throw new Error("Không có người nhận (REPORT_MAIL_TO rỗng).");
  if (!mailerConfigured()) throw new Error(`Thiếu cấu hình mail: ${missingMailConfig().join(", ")}`);

  const from = env("REPORT_MAIL_FROM") || env("REPORT_MAIL_SMTP_USER");
  const cc = parseRecipients(env("REPORT_MAIL_CC"));

  if (mailProvider() === "resend") return sendViaResend({ ...msg, to, cc, from });
  return sendViaSmtp({ ...msg, to, cc, from });
}

async function sendViaSmtp(msg) {
  let nodemailer;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    throw new Error("Thiếu gói nodemailer — chạy: npm i nodemailer");
  }
  const port = Number(env("REPORT_MAIL_SMTP_PORT", "587"));
  const transporter = nodemailer.createTransport({
    host: env("REPORT_MAIL_SMTP_HOST"),
    port,
    secure: port === 465, // 465 = SMTPS; 587 = STARTTLS
    auth: { user: env("REPORT_MAIL_SMTP_USER"), pass: env("REPORT_MAIL_SMTP_PASS") },
  });
  const info = await transporter.sendMail({
    from: msg.from,
    to: msg.to.join(", "),
    cc: msg.cc?.length ? msg.cc.join(", ") : undefined,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    attachments: (msg.attachments || []).map((a) => ({
      filename: a.filename, content: a.content, contentType: a.contentType,
    })),
  });
  return { id: info.messageId, accepted: info.accepted?.length ?? msg.to.length };
}

async function sendViaResend(msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("REPORT_MAIL_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: msg.from,
      to: msg.to,
      cc: msg.cc?.length ? msg.cc : undefined,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: (msg.attachments || []).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
      })),
    }),
  });
  if (!res.ok) throw new Error(`Resend lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json().catch(() => ({}));
  return { id: j.id || "", accepted: msg.to.length };
}
