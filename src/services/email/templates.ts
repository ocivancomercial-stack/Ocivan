const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F8F9F7;font-family:Arial,sans-serif;color:#202522">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
<tr><td><p style="font-size:20px;font-weight:bold;color:#174C3C;margin:0 0 24px">Repassa Aí</p>
<h1 style="font-size:20px;margin:0 0 16px">${escape(title)}</h1>${body}
<p style="font-size:12px;color:#747C76;margin-top:32px">Compre perto. Venda fácil. Desapegue melhor.</p></td></tr></table>
</td></tr></table></body></html>`;
}

export function resetPasswordEmail(name: string, url: string) {
  const safeUrl = escape(url);
  return {
    subject: "Redefinição de senha — Repassa Aí",
    html: layout(
      `Olá, ${name.split(" ")[0]}!`,
      `<p>Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.</p>
<p><a href="${safeUrl}" style="display:inline-block;background:#24845E;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Redefinir senha</a></p>
<p style="font-size:13px;color:#747C76">Se você não pediu, ignore este e-mail — sua senha continua a mesma.</p>`,
    ),
    text: `Olá! Para redefinir sua senha no Repassa Aí, acesse (válido por 1 hora): ${url}\nSe você não pediu, ignore este e-mail.`,
  };
}
