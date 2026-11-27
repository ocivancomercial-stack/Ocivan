/** Faixa visível em qualquer ambiente que não seja produção — evita confundir simulação com operação real. */
export function EnvironmentBanner() {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv === "production") return null;
  const label = process.env.DEMO_MODE === "1" ? "DEMONSTRAÇÃO" : appEnv === "staging" ? "Homologação" : "Desenvolvimento";
  return (
    <div className="bg-accent px-4 py-1 text-center text-xs font-semibold text-brand-900">
      {label} — pagamentos e fretes são SIMULADOS (nenhum dinheiro é cobrado) e os anúncios de exemplo são fictícios.
    </div>
  );
}
