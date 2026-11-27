"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { deleteAccount, PrivacyError } from "./service";

export async function deleteAccountAction(_prev: { message?: string }, formData: FormData): Promise<{ message?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!(await rateLimit(`delete-account:${user.id}`, { max: 5, windowSeconds: 3600 })).allowed) return { message: "Muitas tentativas. Tente mais tarde." };
  if (String(formData.get("confirm")).trim().toUpperCase() !== "EXCLUIR") return { message: "Digite EXCLUIR para confirmar." };
  // Reconfirma a senha (protege contra sessão esquecida aberta em outro aparelho).
  try {
    await auth.api.verifyPassword({ body: { password: String(formData.get("password") ?? "") }, headers: await headers() });
  } catch (e) {
    logger.warn("privacy.delete_password_failed", { userId: user.id, error: String(e).slice(0, 200) });
    return { message: "Senha incorreta." };
  }
  try {
    await deleteAccount(user.id);
  } catch (e) {
    if (!(e instanceof PrivacyError)) logger.error("privacy.delete_failed", { userId: user.id, error: String(e).slice(0, 300) });
    return { message: e instanceof PrivacyError ? e.message : "Não foi possível excluir a conta agora. Fale com o suporte." };
  }
  redirect("/?conta=excluida");
}
