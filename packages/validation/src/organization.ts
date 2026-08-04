import { z } from "zod";

export const organizationSlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens");

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: organizationSlugSchema,
  timezone: z.string().min(1).max(64).default("UTC"),
  organizationType: z
    .enum([
      "private_server",
      "roleplay",
      "department_heavy",
      "law_enforcement",
      "border_roleplay",
      "custom",
    ])
    .default("custom"),
  approximateSize: z.enum(["small", "medium", "large", "enterprise"]).default("small"),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  timezone: z.string().min(1).max(64).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  terminology: z.record(z.string(), z.string()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().max(320),
  roleKey: z.enum(["admin", "moderator", "staff", "member"]).default("member"),
  message: z.string().max(1000).optional(),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});
