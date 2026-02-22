import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { AppError } from "../utils/app-error";

// Initialize S3 Client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: env.r2Endpoint,
  credentials: {
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
  },
});

/**
 * Generates a presigned URL for uploading a file to R2.
 * @param key The file path/name in the bucket (e.g., "sos/123-image.jpg")
 * @param contentType The MIME type of the file
 * @param expiresInSeconds Expiration time in seconds (default: 300)
 */
export async function getUploadUrl(key: string, contentType: string, expiresInSeconds = 300) {
  try {
    const command = new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return { url, key };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new AppError("Failed to generate upload URL", 500);
  }
}

/**
 * Constructs the public URL for a file in R2.
 * @param key The file key
 */
export function getPublicUrl(key: string) {
  if (!key) return "";
  if (key.startsWith("http")) return key; // Already a full URL

  const baseUrl = env.r2PublicDomain
    ? env.r2PublicDomain.replace(/\/$/, "") // Remove trailing slash if any
    : env.r2Endpoint.replace("https://", `https://${env.r2BucketName}.`);

  return `${baseUrl}/${key}`;
}
