/** Validação de CPF (dígitos verificadores). Retorna apenas dígitos ou null. */
export function normalizeCpf(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]) ? d : null;
}

/** "12345678909" → "***.456.789-**" (exibição mascarada). */
export function maskCpf(cpf: string) {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
