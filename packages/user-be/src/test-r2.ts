import { getUploadUrl } from "./common/services/storage.service";
import fs from "fs";

async function testR2() {
  console.log("Testing R2 connection...");
  try {
    const { url, key } = await getUploadUrl("test-ping.txt", "text/plain");
    console.log("Presigned URL generated:", url);

    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "Hello from user-be test script!",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Failed to upload to R2. Status:", response.status, text);
    } else {
      console.log("Successfully uploaded test-ping.txt to R2!");
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testR2();
