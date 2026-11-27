# Ocivan

Projeto Python para gerar imagens e vídeos com a API do [Higgsfield](https://higgsfield.ai).

## Configuração

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export HF_KEY="seu-id:seu-segredo"   # chave criada em console.higgsfield.ai
```

Nunca coloque a chave no código nem faça commit dela.

## Uso

```bash
python gerar_imagem.py "Retrato editorial com luz natural suave"
```

O script imprime a URL da imagem gerada. Cada geração consome créditos da sua conta.
