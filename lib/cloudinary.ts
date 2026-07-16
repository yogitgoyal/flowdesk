import 'dotenv/config';
import { createHash } from "crypto";

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Dev-time debug: log presence (do not log secret values)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[cloudinary] env present:', {
      cloudName: Boolean(cloudName),
      apiKey: Boolean(apiKey),
      apiSecret: Boolean(apiSecret),
    });
  }
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary env vars missing — set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env"
    );
  }

  return { cloudName, apiKey, apiSecret };
}

// Cloudinary's signed-upload scheme: take every param EXCEPT file/api_key/
// resource_type/signature, sort them alphabetically by key, join as
// "key=value&key=value", append the api_secret directly (no separator),
// then sha1 the whole string. See:
// https://cloudinary.com/documentation/upload_widget#generating_authentication_signatures
export function signUploadParams(
  paramsToSign: Record<string, string | number>,
  apiSecret: string
): string {
  const sortedString = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");

  return createHash("sha1").update(sortedString + apiSecret).digest("hex");
}
