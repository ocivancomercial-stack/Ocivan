import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { demoConfirmEmailAction, resendVerificationAction } from "./actions";
import { demoMode } from "@/lib/demo";

/** Aviso para confirmar o e-mail antes de publicar anúncios. */
export function VerifyEmailBanner({ email }: { email: string }) {
  return (
    <Alert tone="warning" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span>Confirme seu e-mail (<strong>{email}</strong>) para publicar anúncios. Você pode montar o anúncio e salvar como rascunho.</span>
      {demoMode() ? (
        <form action={demoConfirmEmailAction}>
          <SubmitButton size="sm" pendingText="Confirmando…">Confirmar agora (demonstração)</SubmitButton>
        </form>
      ) : (
        <form action={resendVerificationAction}>
          <SubmitButton size="sm" variant="outline" pendingText="Enviando…">Reenviar link</SubmitButton>
        </form>
      )}
    </Alert>
  );
}
