import nodemailer from "nodemailer";

function isDevEmailMode() {
  return process.env.EMAIL_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
}

function providerName() {
  return String(process.env.EMAIL_PROVIDER || (isDevEmailMode() ? "mock" : "")).trim().toLowerCase();
}

function maskEmailForLog(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "unknown";
  return `${name.slice(0, 1)}***@${domain}`;
}

function buildSubject() {
  return process.env.EMAIL_CODE_SUBJECT || "你的爱豆体验验证码";
}

function buildText(code) {
  return `你的爱豆体验验证码：${code}。验证码 10 分钟内有效，请不要告诉任何人。`;
}

export function renderLoginCodeEmail(code) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>你的爱豆体验验证码</title>
  </head>
  <body style="margin:0;background:#FFF9FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2F2A35;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#FFFFFF;border:1px solid #EEE6F3;border-radius:20px;padding:28px;">
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.35;color:#2F2A35;">你的爱豆体验验证码</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#8A7F92;">你的验证码是：</p>
        <div style="margin:0 0 20px;font-size:32px;letter-spacing:6px;font-weight:800;color:#8F73D7;">${code}</div>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#2F2A35;">验证码 10 分钟内有效，请不要告诉任何人。</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#8A7F92;">如果这不是你本人操作，可以忽略这封邮件。</p>
      </div>
    </div>
  </body>
</html>`;
}

function getAliyunSmtpTransporter() {
  const host = process.env.ALIYUN_DM_SMTP_HOST || "smtpdm.aliyun.com";
  const port = Number(process.env.ALIYUN_DM_SMTP_PORT || 465);
  const secure = process.env.ALIYUN_DM_SMTP_SECURE !== "false";
  const user = process.env.ALIYUN_DM_SMTP_USER;
  const pass = process.env.ALIYUN_DM_SMTP_PASS;

  if (!user || !pass) {
    throw new Error("Missing ALIYUN_DM_SMTP_USER or ALIYUN_DM_SMTP_PASS");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
}

async function sendWithAliyunSmtp({ to, code }) {
  const transporter = getAliyunSmtpTransporter();
  const from = process.env.EMAIL_FROM || process.env.ALIYUN_DM_SMTP_USER;
  if (!from) {
    throw new Error("Missing EMAIL_FROM or ALIYUN_DM_SMTP_USER");
  }

  await transporter.sendMail({
    from,
    to,
    subject: buildSubject(),
    html: renderLoginCodeEmail(code),
    text: buildText(code)
  });

  return { ok: true, provider: "aliyun_smtp" };
}

export async function sendEmailCode({ email, code }) {
  const provider = providerName();

  if (provider === "mock") {
    console.log(`[email-mock] ${maskEmailForLog(email)} code: ${code}`);
    return { provider: "mock", ok: true };
  }

  if (provider === "aliyun_smtp") {
    return sendWithAliyunSmtp({ to: email, code });
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required for email login.");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: buildSubject(),
        text: buildText(code)
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || `Email provider failed: ${response.status}`);
    }
    return { provider: "resend", ok: true, id: result.id };
  }

  if (provider === "webhook") {
    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    if (!webhookUrl) {
      throw new Error("EMAIL_WEBHOOK_URL is required for email login.");
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {})
      },
      body: JSON.stringify({
        to: email,
        subject: buildSubject(),
        text: buildText(code),
        code
      })
    });
    if (!response.ok) {
      throw new Error(`Email webhook failed: ${response.status}`);
    }
    return { provider: "webhook", ok: true };
  }

  throw new Error("EMAIL_PROVIDER is not configured for production email login.");
}
