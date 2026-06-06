import { useEffect, useState } from "react";

export const ACCOUNT_STORAGE_KEY = "dash:account";
export const ACCOUNT_EVENT_KEY = "growthos:account-filter-updated";

function readSelectedAccount() {
  try {
    return localStorage.getItem(ACCOUNT_STORAGE_KEY) || "all";
  } catch {
    return "all";
  }
}

export function useSelectedAdAccountFilter() {
  const [selectedAccount, setSelectedAccount] = useState(readSelectedAccount);

  useEffect(() => {
    const syncAccount = (event?: Event) => {
      const next = event instanceof CustomEvent ? String(event.detail || "all") : readSelectedAccount();
      setSelectedAccount((current) => (current === next ? current : next));
    };

    window.addEventListener("storage", syncAccount);
    window.addEventListener(ACCOUNT_EVENT_KEY, syncAccount);

    return () => {
      window.removeEventListener("storage", syncAccount);
      window.removeEventListener(ACCOUNT_EVENT_KEY, syncAccount);
    };
  }, []);

  return selectedAccount;
}

export function setSelectedAdAccountFilter(selectedAccount: string) {
  const next = selectedAccount || "all";
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT_KEY, { detail: next }));
  } catch {}
}

export function normalizeSelectedAdAccount(selectedAccount: string) {
  return selectedAccount && selectedAccount !== "all" ? selectedAccount : undefined;
}
