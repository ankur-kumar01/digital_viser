const nodemailer = require('nodemailer');
const { pool } = require('../db');

async function getSmtpConfig() {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'smtp_%'"
  );
  const config = {};
  rows.forEach(r => config[r.setting_key] = r.setting_value);
  return config;
}

function buildTransporter(config) {
  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port, 10) || 587,
    secure: parseInt(config.smtp_port, 10) === 465,
    auth: { user: config.smtp_user, pass: config.smtp_pass },
  });
}

async function sendOtpEmail(to, otp) {
  const config = await getSmtpConfig();
  const transporter = buildTransporter(config);
  if (!transporter) {
    console.warn('[Email] SMTP not configured. Skipping OTP email to', to);
    return false;
  }

  const fromName = config.smtp_from_name || 'Digital Viser';
  const fromEmail = config.smtp_from_email || config.smtp_user;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 2rem; margin-bottom: 4px;">🔐</div>
        <h2 style="margin: 0; color: #111827; font-weight: 700;">Password Reset OTP</h2>
      </div>
      <p style="color: #6b7280; font-size: 0.95rem; text-align: center; margin-bottom: 20px;">
        Use the following OTP to reset your password. This code expires in <strong>10 minutes</strong>.
      </p>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center;">
        <div style="font-size: 2.5rem; font-weight: 800; letter-spacing: 8px; color: #111827; font-family: monospace;">
          ${otp}
        </div>
      </div>
      <p style="color: #9ca3af; font-size: 0.8rem; text-align: center; margin-top: 20px;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: 'Your Password Reset OTP — Digital Viser',
      html,
    });
    console.log('[Email] OTP sent to', to);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send OTP:', err.message);
    return false;
  }
}

module.exports = { sendOtpEmail };
