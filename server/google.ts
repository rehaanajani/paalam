import { GoogleAuth } from "google-auth-library";
import { config, live } from "./config.js";

let auth: GoogleAuth | null = null;

/**
 * An OAuth token for Cloud APIs that don't take API keys. Uses a key file when
 * GOOGLE_APPLICATION_CREDENTIALS points at one; otherwise Application Default
 * Credentials (your gcloud login locally, the attached service account on Cloud Run).
 */
export async function gcpToken(): Promise<string> {
  if (!live.serviceAccount) throw new Error("Needs GOOGLE_CLOUD_PROJECT and a Google login (gcloud auth application-default login)");
  auth ??= new GoogleAuth({ ...(config.serviceAccount ? { keyFile: config.serviceAccount } : {}), scopes: ["https://www.googleapis.com/auth/cloud-platform"], projectId: config.gemini.project });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("The service account returned no token");
  return token;
}

// A personal login (unlike a service account) must say which project the call is billed to.
export const bearer = async () => ({ Authorization: `Bearer ${await gcpToken()}`, "x-goog-user-project": config.gemini.project });
