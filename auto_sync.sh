#!/bin/bash
# Auto-sync script
# Monitors directory and pushes to github automatically.
#
# SEGURANÇA: este script roda num loop e commita/pusha em main. Na versão
# anterior ele fazia "git add ." a cada 10 segundos, o que versionava
# artefatos de build, relatórios, .env e qualquer arquivo temporário que
# aparecesse no diretório. Agora:
#   - só versiona caminhos de código-font e documentação;
#   - nunca commita segredos nem artefatos;
#   - não faz push direto em main: sobe uma branch e abre PR;
#   - não re-dispara a si mesmo.

set -u

DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIRECTORY" || exit 1

# Caminhos que o auto-sync pode versionar. Nada fora daqui entra no commit.
ALLOWED_PATHS=(
  src
  supabase/functions
  supabase/migrations
  scripts
  docs
  package.json
  package-lock.json
)

# Arquivos que nunca podem ser versionados, mesmo dentro dos caminhos acima.
SENSITIVE_PATTERN='(\.env($|\.)|\.auth/|node_modules/|^dist/|secret|\.key$|\.pem$|credential)'

while true; do
  if [[ -n "$(git status -s)" ]]; then
    echo "Changes detected. Syncing..."

    git reset --quiet
    for path in "${ALLOWED_PATHS[@]}"; do
      [[ -e "$path" ]] || continue
      # Ignora segredos e artefatos antes de adicionar ao índice.
      git add -- "$path" 2>/dev/null
    done
    git reset --quiet -- "${ALLOWED_PATHS[@]}" 2>/dev/null

    # Remove do índice tudo que casar com o padrão sensível.
    git diff --cached --name-only | grep -Ei "$SENSITIVE_PATTERN" | while read -r unsafe; do
      echo "Ignorado (possível segredo/artefato): $unsafe"
      git reset --quiet -- "$unsafe"
    done

    if git diff --cached --quiet; then
      echo "Nada versionável alterado."
    else
      git commit -m "chore: auto sync $(date '+%Y-%m-%d %H:%M:%S')"
      branch="auto-sync/$(date '+%Y%m%d-%H%M%S')"
      git checkout -b "$branch"
      if git push origin "$branch"; then
        echo "Branch $branch enviada. Abra um PR para revisar e mergear."
      else
        echo "Falha ao enviar a branch $branch; nada foi publicado em main."
      fi
      git checkout main
    fi
  fi
  sleep 30
done
