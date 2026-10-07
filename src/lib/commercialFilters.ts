export interface CommercialExpertAccountLink {
  expertId: string;
  adAccountId: string;
}

export function getExpertAccountIds(links: CommercialExpertAccountLink[], expertIds: string[]) {
  if (!expertIds.length) return null;
  return new Set(links.filter((link) => expertIds.includes(link.expertId)).map((link) => link.adAccountId));
}

export function validateSellerAvatarFile(file: Pick<File, "type" | "size">) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) return "Escolha uma imagem JPG, PNG ou WebP.";
  if (file.size > 3 * 1024 * 1024) return "A foto deve ter no máximo 3 MB.";
  return null;
}
