/**
 * Versioned, deterministic remediation catalog.
 *
 * The loop may use this catalog only after reproducing a finding. Unknown
 * failures return null and remain blocked for human review; no patch is
 * inferred from arbitrary test output.
 */
export function createAutomaticRemediationPlan(finding) {
  const title = String(finding?.title || "");
  const evidence = JSON.stringify(finding?.evidence || {});
  const signature = String(finding?.signature || "");
  const resiliencePatches = [
    {
      file: "src/lib/resilience.ts",
      expected: 'const RECOVERY_KEY = "growdash:runtime-recovery";\n',
      replacement: 'const RECOVERY_KEY = "growdash:runtime-recovery";\nconst fallbackRecoveryAttempts = new Map<string, { attempts: number; startedAt: number }>();\n',
    },
    {
      file: "src/lib/resilience.ts",
      expected: '  } catch {\n    // With blocked sessionStorage, keep a single safe attempt instead of\n    // creating a reload loop that cannot be remembered.\n    return { attempts: 1, startedAt: Date.now(), blocked: false };\n  }\n',
      replacement: '  } catch {\n    const now = Date.now();\n    const previous = fallbackRecoveryAttempts.get(scope);\n    const current = previous && now - previous.startedAt < windowMs\n      ? { attempts: previous.attempts, startedAt: previous.startedAt }\n      : { attempts: 0, startedAt: now };\n    current.attempts += 1;\n    fallbackRecoveryAttempts.set(scope, current);\n    return { ...current, blocked: current.attempts > limit };\n  }\n',
    },
    {
      file: "src/lib/resilience.ts",
      expected: '  } catch {\n    /* recovery storage is optional */\n  }\n}\n\nexport function isRecoverableChunkError',
      replacement: '  } catch {\n    fallbackRecoveryAttempts.delete(scope);\n  }\n}\n\nexport function isRecoverableChunkError',
    },
  ];

  if (title === "Comando falhou: npm test" && /2026-08-10T03:00:00\.000Z/.test(evidence)) {
    const datePatches = [
      {
        file: "src/hooks/useDateFilter.test.ts",
        expected: "new Date(2026, 7, 10, 0, 0, 0, 0)",
        replacement: 'new Date("2026-08-10T00:00:00-03:00")',
      },
      {
        file: "src/hooks/useDateFilter.test.ts",
        expected: "new Date(2026, 7, 12, 23, 59, 59, 999)",
        replacement: 'new Date("2026-08-12T23:59:59.999-03:00")',
      },
    ];
    const patches = /src\/lib\/resilience\.test\.ts/.test(evidence) ? [...datePatches, ...resiliencePatches] : datePatches;
    return {
      id: "auto-frontend-date-filter-business-timezone-v1",
      findingSignatures: [signature],
      files: [...new Set(patches.map((patch) => patch.file))],
      commands: [],
      tests: ["npm test", "npm run lint", "npm run build", "git diff --check"],
      risk: "low",
      backup: "working-tree snapshot held by the loop",
      rollback: "restore the in-memory file snapshot when validation fails",
      abortWhen: ["expected date markers are absent", "post-patch tests fail"],
      patches,
    };
  }

  if (title === "Comando falhou: npm test" && /src\/lib\/resilience\.test\.ts/.test(evidence)) {
    return {
      id: "auto-frontend-resilience-storage-budget-v1",
      findingSignatures: [signature],
      files: ["src/lib/resilience.ts"],
      commands: [],
      tests: ["npm test", "npm run lint", "npm run build", "git diff --check"],
      risk: "low",
      backup: "working-tree snapshot held by the loop",
      rollback: "restore the in-memory file snapshot when validation fails",
      abortWhen: ["recovery helper markers are absent", "post-patch tests fail"],
      patches: resiliencePatches,
    };
  }

  // Backend, database, authorization and integration findings intentionally
  // have no generic patch. Their catalog entry must be added with an exact
  // reproducer, migration scope, backup and rollback instead of guessing.
  return null;
}
