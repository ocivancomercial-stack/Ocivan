"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getClientIp, getCurrentUser } from "@/lib/session";
import { echoValues, formToObject, zodErrors } from "@/lib/form-data";
import { logger } from "@/lib/logger";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/schemas/auth";
import type { FormState } from "@/types/forms";

const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formToObject(formData, ["termsAccepted"]);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: echoValues(raw) };

  const ip = (await getClientIp()) ?? "unknown";
  if (!(await rateLimit(`signup:${ip}`, { max: 5, windowSeconds: 600 })).allowed) return { message: TOO_MANY, values: echoValues(raw) };

  const { name, email, password, phone, city } = parsed.data;
  try {
    await auth.api.signUpEmail({
      body: { name, email, password, phone, city, termsAccepted: true } as never,
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error) && /exist/i.test(error.message))
      return { errors: { email: ["Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha."] }, values: echoValues(raw) };
    logger.warn("auth.signup_failed", { error: String(error) });
    return { message: isAPIError(error) ? error.message : "Não foi possível criar a conta agora.", values: echoValues(raw) };
  }
  redirect(safeRedirectPath(formData.get("next"), "/perfil?bemvindo=1"));
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formToObject(formData, ["remember"]);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: echoValues(raw) };

  const ip = (await getClientIp()) ?? "unknown";
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`signin:ip:${ip}`, { max: 20, windowSeconds: 600 }),
    rateLimit(`signin:email:${parsed.data.email}`, { max: 5, windowSeconds: 600 }),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return { message: TOO_MANY, values: echoValues(raw) };

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password, rememberMe: parsed.data.remember },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error) && error.status === "FORBIDDEN") return { message: error.message, values: echoValues(raw) };
    // Mensagem genérica: não revela se o e-mail existe.
    return { message: "E-mail ou senha incorretos.", values: echoValues(raw) };
  }
  redirect(safeRedirectPath(formData.get("next"), "/"));
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formToObject(formData);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: echoValues(raw) };

  const ip = (await getClientIp()) ?? "unknown";
  const limited = !(await rateLimit(`forgot:${ip}`, { max: 5, windowSeconds: 600 })).allowed;
  if (!limited) {
    try {
      await auth.api.requestPasswordReset({ body: { email: parsed.data.email, redirectTo: "/redefinir-senha" }, headers: await headers() });
    } catch (error) {
      logger.warn("auth.forgot_failed", { error: String(error) });
    }
  }
  // Resposta idêntica em qualquer caso (anti-enumeração de contas).
  return { ok: true, message: "Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha em instantes." };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formToObject(formData);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  try {
    await auth.api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.password }, headers: await headers() });
  } catch {
    return { message: "Link inválido ou expirado. Peça um novo link de redefinição." };
  }
  redirect("/entrar?senha=redefinida");
}

export async function resendVerificationAction() {
  const user = await getCurrentUser();
  if (!user || user.emailVerified) return;
  if (!(await rateLimit(`verify:${user.id}`, { max: 3, windowSeconds: 600 })).allowed) return;
  try {
    await auth.api.sendVerificationEmail({ body: { email: user.email, callbackURL: "/vender" }, headers: await headers() });
  } catch (error) {
    logger.warn("auth.verify_resend_failed", { error: String(error) });
  }
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
