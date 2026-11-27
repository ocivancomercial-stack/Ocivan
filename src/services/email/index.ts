import { logger } from "@/lib/logger";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Driver de DESENVOLVIMENTO: não envia nada, apenas registra no log do servidor.
 * Bloqueado em produção por src/lib/env.ts.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
    logger.info("email.simulated", { to: message.to, subject: message.subject, text: message.text });
  }
}

/** Resend (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private apiKey: string, private from: string) {}
  async send(message: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!res.ok) {
      logger.error("email.send_failed", { status: res.status, subject: message.subject });
      throw new Error(`Falha ao enviar e-mail (HTTP ${res.status})`);
    }
  }
}

let provider: EmailProvider | undefined;
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const driver = process.env.EMAIL_PROVIDER ?? "console";
  if (driver === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY não configurada");
    provider = new ResendEmailProvider(key, process.env.EMAIL_FROM ?? "Repassa Aí <nao-responda@repassaai.com.br>");
  } else {
    if (process.env.APP_ENV === "production") throw new Error("E-mail em console é proibido em produção");
    provider = new ConsoleEmailProvider();
  }
  return provider;
}

/** Permite injetar um provider nos testes. */
export function setEmailProvider(p: EmailProvider) {
  provider = p;
}
