"""Gera uma imagem com a API do Higgsfield (modelo Soul v2).

Uso:
    python gerar_imagem.py "Retrato editorial com luz natural suave"

Credenciais: o SDK lê a variável HF_KEY no formato "ID:SEGREDO".
No ambiente em nuvem do Claude, HF_KEY tem um valor falso e o proxy
coloca a chave real nas chamadas para api.higgsfield.ai.
Fora dele, exporte sua chave: export HF_KEY="seu-id:seu-segredo"
"""

import sys

import higgsfield_client

MODELO = "higgsfield-ai/soul/v2/standard"


def gerar(prompt: str) -> str:
    resultado = higgsfield_client.subscribe(MODELO, arguments={"prompt": prompt})
    imagens = resultado.get("images") or []
    if not imagens:
        raise RuntimeError(f"Nenhuma imagem retornada: {resultado}")
    return imagens[0]["url"]


if __name__ == "__main__":
    texto = " ".join(sys.argv[1:]) or "Retrato editorial com luz natural suave"
    print(gerar(texto))
