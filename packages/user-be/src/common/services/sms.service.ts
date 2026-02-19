import { env } from "../../config/env";

export async function sendOtp(phone: string, code: string) {
  // In a real app, integrate with Twilio / msg91 / Firebase here
  console.log(`[SMS MOCK] Sending OTP ${code} to ${phone}`);
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return true;
}
