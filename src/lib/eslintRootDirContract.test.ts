import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const gitignoreSource = readFileSync(
  fileURLToPath(new URL("../../.gitignore", import.meta.url)),
  "utf8",
);

describe("eslint — contrato de raiz do tsconfig", () => {
  it("ignora os worktrees aninhados, que trazem tsconfig próprio", () => {
    // Cada worktree do Claude Opus 5 Code traz o seu tsconfig.json. O ESLint então
    // encontra várias raízes candidatas e aborta com "multiple candidate
    // TSConfigRootDirs are present" em todo arquivo — o que derrubou
    // `npm run lint` com milhares de erros e bloqueou o gate do
    // loop-engineering. A exclusão precisa estar no .gitignore versionado,
    // não só no .git/info/exclude local.
    expect(gitignoreSource).toContain(".claude/worktrees/");
  });

  it("mantém os worktrees fora do status do Git", () => {
    expect(gitignoreSource).toMatch(/^\.claude\/worktrees\/$/m);
  });
});
