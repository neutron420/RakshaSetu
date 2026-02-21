import { env } from "../../config/env";

export async function sendOtp(phone: string, code: string) {
  // Ensure phone has country code (default to +91 for India)
  const toPhone = phone.startsWith("+") ? phone : `+91${phone}`;

  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioPhoneNumber) {
    console.warn("[SMS] Twilio credentials not set, falling back to console log");
    console.log(`\n══════════════════════════════════════`);
    console.log(`  📱 OTP for ${toPhone}: ${code}`);
    console.log(`══════════════════════════════════════\n`);
    return true;
  }

  console.log(`[SMS] Sending OTP to ${toPhone} via Twilio...`);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64"),
    },
    body: new URLSearchParams({
      From: env.twilioPhoneNumber,
      To: toPhone,
      Body: `Your RakshaSetu OTP is: ${code}. Valid for 5 minutes.`,
    }).toString(),
  });

  const data = await res.json();

  if (!res.ok || data.error_code) {
    console.error("[SMS] Twilio error:", data);
    throw new Error(data.message || "Failed to send OTP via Twilio");
  }

  console.log(`[SMS] OTP sent successfully to ${toPhone} (SID: ${data.sid})`);
  return true;
}
