"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { zodErrors } from "@/lib/form-data";
import { productInputSchema, reportSchema } from "@/schemas/product";
import { IMAGE_RULES } from "@/services/images/process";
import { changeProductStatus, createProduct, parseImageOrder, ProductError, updateProduct } from "./service";
import { createReport } from "./report-service";
import type { OwnerAction } from "./status";

export type SaveListingResult =
  | { ok: true; productId: string; status: string }
  | { ok: false; message?: string; errors?: Record<string, string[] | undefined> };

const FIELDS = ["title", "categoryId", "brandId", "size", "color", "condition", "description", "defects", "price", "city"] as const;

export async function saveListingAction(formData: FormData): Promise<SaveListingResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  if (!(await rateLimit(`listing:${user.id}`, { max: 30, windowSeconds: 3600 })).allowed)
    return { ok: false, message: "Muitos anúncios em pouco tempo. Tente mais tarde." };

  const raw: Record<string, unknown> = Object.fromEntries(FIELDS.map((f) => [f, formData.get(f) ?? undefined]));
  raw.shippingAvailable = formData.get("shippingAvailable") === "true";
  raw.localPickup = formData.get("localPickup") === "true";
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > IMAGE_RULES.maxPerProduct) return { ok: false, errors: { photos: ["Máximo de 8 fotos por anúncio"] } };
  if (files.some((f) => f.size > IMAGE_RULES.maxBytes)) return { ok: false, errors: { photos: ["Cada foto pode ter no máximo 8 MB"] } };
  const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));

  const intentRaw = String(formData.get("intent") ?? "publish");
  const intent = (["draft", "publish", "save"].includes(intentRaw) ? intentRaw : "publish") as "draft" | "publish" | "save";
  const productId = formData.get("productId");

  try {
    const product =
      typeof productId === "string" && productId
        ? await updateProduct(user.id, productId, parsed.data, buffers, parseImageOrder(formData.get("imageOrder") as string | null, buffers.length), intent)
        : await createProduct(user.id, parsed.data, buffers, intent === "draft" ? "draft" : "publish");
    revalidatePath("/vender/anuncios");
    revalidatePath(`/produto/${product.id}`);
    return { ok: true, productId: product.id, status: product.status };
  } catch (e) {
    if (e instanceof ProductError) return e.field ? { ok: false, errors: { [e.field]: [e.message] } } : { ok: false, message: e.message };
    logger.error("listing.save_failed", { userId: user.id, error: String(e) });
    return { ok: false, message: "Não foi possível salvar o anúncio agora. Tente novamente." };
  }
}

export async function changeListingStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre novamente." };
  const action = String(formData.get("action"));
  if (!["publish", "pause", "reactivate", "remove"].includes(action)) return { ok: false, message: "Ação inválida" };
  try {
    await changeProductStatus(user.id, String(formData.get("productId")), action as Exclude<OwnerAction, "edit">);
  } catch (e) {
    return { ok: false, message: e instanceof ProductError ? e.message : "Não foi possível alterar o anúncio." };
  }
  revalidatePath("/vender/anuncios");
  return { ok: true };
}

export type ReportState = { ok?: boolean; message?: string };

export async function reportProductAction(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre para denunciar um anúncio." };
  if (!(await rateLimit(`report:${user.id}`, { max: 10, windowSeconds: 3600 })).allowed) return { ok: false, message: "Muitas denúncias em pouco tempo." };
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Escolha um motivo." };
  const r = await createReport(user.id, parsed.data);
  if (!r.ok) return { ok: false, message: r.error };
  return { ok: true, message: "Denúncia enviada. Nossa equipe vai analisar. Obrigado!" };
}

export type SuggestListingState = { ok: true; suggestion: import("./ai-suggest").ListingSuggestionResult } | { ok: false; message: string };

export async function suggestListingAction(formData: FormData): Promise<SuggestListingState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre novamente." };
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, message: "Adicione uma foto primeiro." };
  if (photo.size > IMAGE_RULES.maxBytes) return { ok: false, message: "Foto muito grande." };
  const { suggestListingFromPhoto } = await import("./ai-suggest");
  const { AssistantError } = await import("@/services/ai/listing-assistant");
  const { ImageValidationError } = await import("@/services/images/process");
  try {
    return { ok: true, suggestion: await suggestListingFromPhoto(user.id, Buffer.from(await photo.arrayBuffer())) };
  } catch (e) {
    if (e instanceof AssistantError || e instanceof ImageValidationError) return { ok: false, message: e.message };
    logger.error("ai.suggest_failed", { userId: user.id, error: String(e) });
    return { ok: false, message: "Não foi possível gerar sugestões agora. Preencha manualmente." };
  }
}
