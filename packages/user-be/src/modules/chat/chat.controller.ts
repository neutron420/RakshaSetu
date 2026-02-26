import type { Request, Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { requireAuth } from "../../common/utils/require-auth";
import { ok } from "../../common/utils/response";

import { getNearbyCenters, fetchAndSaveReliefCenters } from "../relief-centers/relief-centers.service";

export async function chatWithRakshaBot(req: Request, res: Response) {
  requireAuth(req); // Ensure user is logged in
  
  const { message, latitude, longitude } = req.body;
  
  if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
  }

  let locationStr = `User Location: Unknown (Remind the user to enable location services if location is important for their request.)`;
  
  console.log(`[Chat API] Received User Message. Lat: ${latitude}, Lng: ${longitude}`);

  if (latitude && longitude) {
    locationStr = `User Location: Latitude ${latitude}, Longitude ${longitude}\n\nNearby Relief Centers / Hospitals / Shelters:\n`;
    try {
      let centers = await getNearbyCenters(latitude, longitude, 15000); // 15km radius
      
      if (!centers || centers.length === 0) {
        console.log(`[Chat API] Falling back to Mapbox API to fetch centers...`);
        // Fetch from Mapbox to populate DB if nothing was found
        const mapboxRes = await fetchAndSaveReliefCenters(latitude, longitude, 15000);
        console.log(`[Chat API] Mapbox fetch result:`, mapboxRes);
        centers = await getNearbyCenters(latitude, longitude, 15000);
      }

      if (centers && centers.length > 0) {
        const topCenters = centers.slice(0, 5).map((c: any) => {
          let distStr = c.distance ? `${(c.distance / 1000).toFixed(1)}km away` : "";
          return `- ${c.name} (${c.type}): ${c.address || 'Address unavailable'} | Status: ${c.status} | Dist: ${distStr} | Lat: ${c.latitude}, Lng: ${c.longitude}`;
        });
        locationStr += topCenters.join('\n');
      } else {
        locationStr += "No relief centers found in the immediate 15km vicinity in the database.";
      }
    } catch (err) {
      console.error("[Chat API] Error fetching nearby centers:", err);
      locationStr += "Unable to fetch nearby centers at the moment.";
    }
  }

  const promptTemplate = new PromptTemplate({
    template: `You are RakshaSetu AI, a disaster relief and emergency response assistant for India.

Your role:
- Help users during disasters like floods, fire, earthquake, cyclone, landslide, medical emergencies.
- Give clear, short, actionable instructions.
- Use the user's current GPS location (latitude and longitude provided separately) to give nearby help information.
- If location data is available, always include nearest:
  - Relief centers
  - Hospitals
  - Police stations
  - Emergency shelters
- If exact location is not available, guide the user generally and ask them to enable location.

Response Rules:
1. Keep answers short and direct.
2. Use simple language.
3. Prioritize safety instructions first.
4. If life-threatening, tell user to call emergency numbers in India:
   - 112 (National Emergency)
   - 108 (Ambulance)
   - 100 (Police)
   - 101 (Fire)
5. Never give unsafe or risky advice.
6. If user is panicking, calm them.
7. Always give step-by-step instructions.
8. NEVER make up fake locations or examples like "XYZ School". ONLY use the absolute real locations provided in the context below.
9. CRITICAL: When suggesting a nearby relief center or hospital from the context, you MUST provide a clickable Markdown link that redirects into the app's internal map. Use this exact format:
   [View on Map](rakshasetu://explore)

Tone:
- Calm
- Reassuring
- Clear
- Authoritative but caring

Never discuss politics.
Never provide unrelated entertainment.
Stay focused on emergency help.

If user asks something outside disaster help, gently redirect to safety assistance.

{locationStr}

User Message: {userInput}
RakshaSetu AI:`,
    inputVariables: ["userInput", "locationStr"],
  });

  const model = new ChatOpenAI({ 
    modelName: "gpt-4o-mini", 
    temperature: 0.3,
    maxRetries: 2,
    timeout: 15000, // Fail fast after 15 seconds instead of waiting 90s for ECONNRESET
  });

  const parser = new StringOutputParser();
  const chain = promptTemplate.pipe(model).pipe(parser);

  try {
    const reply = await chain.invoke({ userInput: message, locationStr });
    return ok(res, "Chat response generated", { reply });
  } catch (err: any) {
    console.error("[Chat API] Error:", err);
    return res.status(500).json({ success: false, error: "AI Service Unavailable" });
  }
}

import OpenAI, { toFile } from "openai";

export async function chatWithRakshaBotAudio(req: Request, res: Response) {
  requireAuth(req);

  const { latitude, longitude } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, error: "Audio file is required" });
  }

  try {
    const openai = new OpenAI();
    
    // Convert multer buffer to OpenAI File object
    const audioFile = await toFile(file.buffer, "audio.m4a", { type: file.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    const message = transcription.text;
    console.log(`[Chat API] Transcribed Audio: "${message}"`);

    // Reuse the exact same location mapping and chain logic as text chat
    let locationStr = `User Location: Unknown (Remind the user to enable location services if location is important for their request.)`;
    if (latitude && longitude) {
      locationStr = `User Location: Latitude ${latitude}, Longitude ${longitude}\n\nNearby Relief Centers / Hospitals / Shelters:\n`;
      try {
        let centers = await getNearbyCenters(latitude, longitude, 15000); // 15km radius
        if (!centers || centers.length === 0) {
          await fetchAndSaveReliefCenters(latitude, longitude, 15000);
          centers = await getNearbyCenters(latitude, longitude, 15000);
        }

        if (centers && centers.length > 0) {
          const topCenters = centers.slice(0, 5).map((c: any) => {
            let distStr = c.distance ? `${(c.distance / 1000).toFixed(1)}km away` : "";
            return `- ${c.name} (${c.type}): ${c.address || 'Address unavailable'} | Status: ${c.status} | Dist: ${distStr} | Lat: ${c.latitude}, Lng: ${c.longitude}`;
          });
          locationStr += topCenters.join('\n');
        } else {
          locationStr += "No relief centers found in the immediate 15km vicinity in the database.";
        }
      } catch (err) {
        console.error("[Chat API] Error fetching nearby centers:", err);
        locationStr += "Unable to fetch nearby centers at the moment.";
      }
    }

    const promptTemplate = new PromptTemplate({
      template: `You are RakshaSetu AI, a disaster relief and emergency response assistant for India.

Your role:
- Help users during disasters like floods, fire, earthquake, cyclone, landslide, medical emergencies.
- Give clear, short, actionable instructions.
- Use the user's current GPS location (latitude and longitude provided separately) to give nearby help information.
- If location data is available, always include nearest:
  - Relief centers
  - Hospitals
  - Police stations
  - Emergency shelters
- If exact location is not available, guide the user generally and ask them to enable location.

Response Rules:
1. Keep answers short and direct.
2. Use simple language.
3. Prioritize safety instructions first.
4. If life-threatening, tell user to call emergency numbers in India:
   - 112 (National Emergency)
   - 108 (Ambulance)
   - 100 (Police)
   - 101 (Fire)
5. Never give unsafe or risky advice.
6. If user is panicking, calm them.
7. Always give step-by-step instructions.
8. NEVER make up fake locations or examples like "XYZ School". ONLY use the absolute real locations provided in the context below.
9. CRITICAL: When suggesting a nearby relief center or hospital from the context, you MUST provide a clickable Markdown link that redirects into the app's internal map. Use this exact format:
   [View on Map](rakshasetu://explore)

Tone:
- Calm
- Reassuring
- Clear
- Authoritative but caring

Never discuss politics.
Never provide unrelated entertainment.
Stay focused on emergency help.

If user asks something outside disaster help, gently redirect to safety assistance.

{locationStr}

User Message: {userInput}
RakshaSetu AI:`,
      inputVariables: ["userInput", "locationStr"],
    });

    const model = new ChatOpenAI({ 
      modelName: "gpt-4o-mini", 
      temperature: 0.3,
      maxRetries: 2,
      timeout: 15000, 
    });

    const parser = new StringOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);

    const reply = await chain.invoke({ userInput: message, locationStr });
    
    // Return BOTH the transcribed text (so the frontend can display the user's message) and the AI reply
    return ok(res, "Audio chat response generated", { transcription: message, reply });

  } catch (err: any) {
    console.error("[Chat API] Audio Error:", err);
    return res.status(500).json({ success: false, error: "Audio Processing Failed" });
  }
}
