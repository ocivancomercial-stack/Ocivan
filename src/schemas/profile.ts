import { z } from "zod";
import { citySchema, phoneSchema } from "@/schemas/auth";

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(100),
  phone: phoneSchema,
  city: citySchema,
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  recipient: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().transform((v) => v.replace(/\D/g, "")).refine((v) => /^\d{8}$/.test(v), "CEP inválido"),
  street: z.string().trim().min(2, "Informe a rua").max(150),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(80).optional().or(z.literal("")),
  neighborhood: z.string().trim().min(2, "Informe o bairro").max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2, "UF inválida").transform((v) => v.toUpperCase()),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;
