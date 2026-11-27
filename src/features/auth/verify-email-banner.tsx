import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerificationAction } from "./actions";

/** Aviso para confirmar o e-mail antes de publicar anúncios. */
export function VerifyEmailBanner({ email }: { email: string }) {
  return (
    <Alert tone="warning" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span>Confirme seu e-mail (<strong>{email}</strong>) para publicar anúncios. Você pode montar o anúncio e salvar como rascunho.</span>
      <form action={resendVerificationAction}>
        <SubmitButton size="sm" variant="outline" pendingText="Enviando…">Reenviar link</SubmitButton>
      </form>
    </Alert>
  );
}
