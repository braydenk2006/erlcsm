import { WebsiteBuilder } from "@/components/website/website-builder";
import { PlanRequired } from "@/components/plan-required";
import { requireActiveOrganization } from "@/lib/organization";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Website" };
export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const { organizationId, organization } = await requireActiveOrganization();
  if (!(await hasFeature(organizationId, "website.builder"))) {
    return <PlanRequired feature="website.builder" />;
  }
  return <WebsiteBuilder orgSlug={organization.slug} />;
}
