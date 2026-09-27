export type MetaTokenInspection = {
  isValid: boolean;
  expiresAt: string | null;
  dataAccessExpiresAt: string | null;
  issuedAt: string | null;
  permissions: string[];
  appId: string | null;
  errorCode: number | null;
  errorMessage: string | null;
};

export async function inspectMetaToken(
  token: string,
  appId: string | undefined,
  appSecret: string | undefined,
): Promise<MetaTokenInspection> {
  if (!appId || !appSecret) {
    return {
      isValid: false,
      expiresAt: null,
      dataAccessExpiresAt: null,
      issuedAt: null,
      permissions: [],
      appId: null,
      errorCode: null,
      errorMessage: "META_APP_ID/META_APP_SECRET não configurados",
    };
  }

  const debugUrl = new URL("https://graph.facebook.com/debug_token");
  debugUrl.searchParams.set("input_token", token);
  debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);
  const response = await fetch(debugUrl, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  const error = payload?.error;
  const data = payload?.data ?? {};
  const asIso = (seconds: unknown) => {
    const value = Number(seconds);
    return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
  };

  return {
    isValid: response.ok && data.is_valid === true && !error,
    expiresAt: asIso(data.expires_at),
    dataAccessExpiresAt: asIso(data.data_access_expiration_time),
    issuedAt: asIso(data.issued_at),
    permissions: Array.isArray(data.scopes) ? data.scopes.map(String) : [],
    appId: data.app_id ? String(data.app_id) : null,
    errorCode: Number.isFinite(Number(error?.code)) ? Number(error.code) : null,
    errorMessage: error?.message ? String(error.message) : null,
  };
}

export function hasMinimumMetaTokenLifetime(expiresAt: string | null, minimumDays = 30, dataAccessExpiresAt: string | null = null): boolean {
  const effectiveExpiry = expiresAt || dataAccessExpiresAt;
  if (!effectiveExpiry) return false;
  const expiry = new Date(effectiveExpiry).getTime();
  return Number.isFinite(expiry) && expiry >= Date.now() + minimumDays * 86_400_000;
}
