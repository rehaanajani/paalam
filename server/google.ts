import { GoogleAuth } from "google-auth-library";
import { config, live } from "./config.js";

let auth: GoogleAuth | null = null;

/** An OAuth token from the `paalam` service account, for Cloud APIs that don't take API keys. */
export async function gcpToken(): Promise<string> {
  if (!live.serviceAccount) throw new Error("Needs GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT");
  auth ??= new GoogleAuth({ keyFile: config.serviceAccount, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("The service account returned no token");
  return token;
}

export const bearer = async () => ({ Authorization: `Bearer ${await gcpToken()}` });
