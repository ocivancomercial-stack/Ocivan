import { z } from "zod";
import { SERVED_CITY_NAMES } from "@/lib/regions";

/**
 * Política de senha: 8–128 caracteres, ao menos uma letra e um número,
 * e não pode conter o próprio e-mail. (Alinhada a NIST SP 800-63B: comprimento > complexidade.)
 */
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .max(128, "A senha pode ter no máximo 128 caracteres")
  .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra")
  .regex(/\d/, "Inclua pelo menos um número");

const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "password1", "senha123", "senha1234", "qwerty123", "abc12345", "11111111a",
  "repassa123", "curitiba1", "brasil123",
]);

export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) problems.push(...parsed.error.issues.map((i) => i.message));
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push("Essa senha é muito comum");
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local))
    problems.push("A senha não pode conter seu e-mail");
  return problems;
}

export const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254);

// Telefone BR: aceita (41) 99999-9999, 41999999999, +55 41 99999-9999. Normaliza para dígitos.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""))
  .refine((v) => /^[1-9]{2}9?\d{8}$/.test(v), "Informe um telefone válido com DDD");

export const citySchema = z.enum(SERVED_CITY_NAMES, {
  error: "No momento atendemos apenas Curitiba e Região Metropolitana",
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(3, "Informe seu nome completo").max(100)
      .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
    email: emailSchema,
    phone: phoneSchema,
    password: z.string(),
    confirmPassword: z.string(),
    city: citySchema,
    termsAccepted: z.literal(true, { error: "É preciso aceitar os termos e a política de privacidade" }),
  })
  .superRefine((data, ctx) => {
    for (const message of passwordProblems(data.password, data.email))
      ctx.addIssue({ code: "custom", path: ["password"], message });
    if (data.password !== data.confirmPassword)
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As senhas não conferem" });
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha").max(128),
  remember: z.boolean().default(true),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(1), password: z.string(), confirmPassword: z.string() })
  .superRefine((data, ctx) => {
    for (const message of passwordProblems(data.password))
      ctx.addIssue({ code: "custom", path: ["password"], message });
    if (data.password !== data.confirmPassword)
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As senhas não conferem" });
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
