# Versão HTML estática

A versão HTML é gerada a partir dos mesmos componentes, estilos e conteúdos da
recuperação Growdash. A navegação utiliza hash (`#/rota`) para funcionar em
qualquer hospedagem estática, inclusive em subpastas.

## Gerar

```bash
npm run build:html
```

O site será criado em `html/`.

## Visualizar

Navegadores bloqueiam módulos JavaScript quando um HTML moderno é aberto
diretamente por `file://`. Use um servidor estático local:

```bash
npx serve html
```

Ou publique o conteúdo da pasta `html/` em Vercel, Netlify, Cloudflare Pages,
GitHub Pages ou hospedagem equivalente.

## Rotas

Exemplos:

- `#/`
- `#/trafego-pago`
- `#/crm`
- `#/growdash-flow`
- `#/integracoes`
- `#/configuracoes`

## Observação

Esta versão replica a interface e a lógica de front-end recuperadas. Recursos
que consultam Supabase, Meta Ads ou RD Station continuam dependendo das
variáveis de ambiente e permissões do backend original.

