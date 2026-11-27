import { cookies } from "next/headers";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/** Estado OAuth (state + PKCE verifier + usuário) em cookie httpOnly cifrado, válido por 10 minutos. */
const NAME = "ra_oauth";

export async function saveOAuthState(data: { provider: string; state: string; userId: string; codeVerifier?: string }) {
  (await cookies()).set(NAME, encryptSecret(JSON.stringify({ ...data, exp: Date.now() + 600_000 })), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations", maxAge: 600,
  });
}

export async function consumeOAuthState(provider: string, state: string | null, userId: string) {
  const jar = await cookies();
  const raw = jar.get(NAME)?.value;
  jar.delete({ name: NAME, path: "/api/integrations" });
  if (!raw || !state) return null;
  try {
    const d = JSON.parse(decryptSecret(raw)) as { provider: string; state: string; userId: string; codeVerifier?: string; exp: number };
    return d.provider === provider && d.state === state && d.userId === userId && d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}
