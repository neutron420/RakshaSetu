import { WebSocket } from "ws";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretdevelopmentkey"; 

const publisherToken = jwt.sign(
  { sub: "user-publisher-1", email: "pub@test.com", role: "USER" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const subscriberToken = jwt.sign(
  { sub: "user-responder-1", email: "sub@test.com", role: "RESPONDER" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const PORT = process.env.PORT || 5001; // standard user-be dev port
const WS_URL = `ws://localhost:${PORT}/ws`;

const publisher = new WebSocket(`${WS_URL}?token=${publisherToken}`);
const subscriber = new WebSocket(`${WS_URL}?token=${subscriberToken}`);

subscriber.on("open", () => {
  console.log("[Sub] Connected. Subscribing to publisher...");
  subscriber.send(
    JSON.stringify({
      type: "location:subscribe",
      payload: { targetUserId: "user-publisher-1" },
    })
  );
});

subscriber.on("error", (err) => console.error("[Sub] Error:", err.message));
subscriber.on("close", (code) => console.log(`[Sub] Closed with code ${code}`));

subscriber.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "pong") return;
  console.log("[Sub] Received message:", JSON.stringify(msg, null, 2));
});

publisher.on("open", () => {
  console.log("[Pub] Connected. Starting to broadcast location...");
  
  let lat = 19.0760;
  let lng = 72.8777;

  setInterval(() => {
    lat += 0.0001; // simulate moving
    lng += 0.0001;
    
    console.log(`[Pub] Sending location update: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    publisher.send(
      JSON.stringify({
        type: "location:update",
        payload: { latitude: lat, longitude: lng, heading: 45, speed: 15 },
      })
    );
  }, 2000);
});

publisher.on("error", (err) => console.error("[Pub] Error:", err.message));
publisher.on("close", (code) => console.log(`[Pub] Closed with code ${code}`));

// Run this for a few seconds to see the interaction
setTimeout(() => {
  console.log("Test finished. Closing connections.");
  publisher.close();
  subscriber.close();
  process.exit(0);
}, 10000);
