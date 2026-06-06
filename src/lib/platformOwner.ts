export const PLATFORM_OWNER_EMAIL = "marketingdigital3t@gmail.com";

export function isPlatformOwnerEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}
