# n8n da Growdash

O n8n roda como um serviço separado em um VPS. A Growdash apenas oferece um
atalho para `https://automation.growdash.com.br`; nenhum código do n8n é
versionado neste repositório.

## Provisionamento

1. Crie um VPS Ubuntu com Docker Engine e o plugin `docker compose` instalado.
2. Crie um registro DNS `A` para `automation.growdash.com.br` apontando para o
   IP público do VPS.
3. No VPS, copie esta pasta e crie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   openssl rand -base64 32
   ```

   Cole o valor gerado em `N8N_ENCRYPTION_KEY` dentro do `.env`. Nunca faça
   commit desse arquivo.

4. Suba os serviços:

   ```bash
   docker compose up -d
   docker compose ps
   ```

5. Abra `https://automation.growdash.com.br`. No primeiro acesso, crie a conta
   owner do n8n e conclua a configuração inicial.

## Licença e acesso

O n8n usa licença fair-code. O uso interno da equipe é permitido sem uma
licença adicional. Não exponha o editor do n8n para clientes finais da
Growdash sem a licença Embed paga. Mantenha o subdomínio protegido e o acesso
restrito à equipe autorizada.

O Caddy termina o HTTPS automaticamente quando o DNS já estiver propagado e as
portas 80/443 estiverem liberadas no firewall do VPS.

## Checklist manual

- [ ] Provisionar o VPS e instalar Docker + Docker Compose.
- [ ] Configurar o DNS `automation.growdash.com.br`.
- [ ] Criar `.env` e uma chave `N8N_ENCRYPTION_KEY` persistente.
- [ ] Executar `docker compose up -d`.
- [ ] Criar o owner no primeiro acesso.
- [ ] Recriar, pela UI do n8n, os fluxos necessários (por exemplo, Lead Ads →
      Sheets → WhatsApp).
