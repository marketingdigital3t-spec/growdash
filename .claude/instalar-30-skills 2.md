# Instalar as 30 skills do guia no Claude Sonnet 5 Code

Cole cada bloco no Claude Sonnet 5 Code (o terminal do seu Mac), um de cada vez.
Nao cole aqui no chat do Cowork — o /plugin so existe dentro do Claude Sonnet 5 Code.

## Loja oficial (ja vem pronta, nao precisa adicionar marketplace)

/plugin install superpowers@claude-plugins-official
/plugin install mattpocock-skills@claude-plugins-official

## Adicionar o marketplace e instalar (cole as duas linhas de cada bloco)

/plugin marketplace add affaan-m/ECC
/plugin install ecc@ecc

/plugin marketplace add multica-ai/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills

/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail

/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills

/plugin marketplace add Egonex-AI/Understand-Anything
/plugin install understand-anything@understand-anything

/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman

/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem

/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill

/plugin marketplace add Leonxlnx/taste-skill
/plugin install taste-skill@taste-skill

/plugin marketplace add cathrynlavery/diagram-design
/plugin install diagram-design@diagram-design

/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills

/plugin marketplace add blader/humanizer
/plugin install humanizer@humanizer

/plugin marketplace add coreyhaines31/marketingskills
/plugin install marketing-skills

## Estes NAO sao /plugin — rode no Terminal normal do Mac

uv tool install graphifyy && graphify install
npx skills add mvanhorn/last30days-skill -g -a claude-code
npx @santifer/career-ops init
npx rea-agents setup
npx @opengsd/gsd-core@latest
npx bmad-method install
npx impeccable install
Claude Sonnet 5 plugin marketplace add heygen-com/hyperframes && Claude Sonnet 5 plugin install hyperframes@hyperframes

## Estes pedem para COLAR o texto no Claude Sonnet 5 Code

Instala o Agent Reach seguindo este guia: https://raw.githubusercontent.com/Panniantong/Agent-Reach/main/docs/install.md

Install gstack: run git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup then add a "gstack" section to CLAUDE.md

Install Archify for me by reading https://raw.githubusercontent.com/tt-a1i/archify/main/llms.txt

Install the i-have-adhd skill/plugin from https://github.com/ayghri/i-have-adhd, refer to the repo's AGENTS.md for instructions.

## Estes sao projetos grandes (Python/Node/ffmpeg) — so instale se for usar

git clone https://github.com/hugohe3/ppt-master.git && cd ppt-master && pip install -r requirements.txt
git clone https://github.com/OpenMontageInc/OpenMontage.git && cd OpenMontage && make setup
uv tool install --python 3.13 "headroom-ai[all]"

## Conferir depois

/plugin

## Sincronizar skills depois de instalar

Depois que os plugins estiverem instalados, rode no Terminal normal do Mac
para copiar as skills para o projeto e para o global:

# Projeto (fica dentro do repo, versionado)
npx skills experimental_sync -y

# Global (vale para todos os projetos no seu Mac)
npx skills add --global -y

# Conferir o que ficou instalado
npx skills list
