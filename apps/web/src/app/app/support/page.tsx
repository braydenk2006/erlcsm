import { SupportView } from "@/components/support/support-view";
import { requireActiveOrganization } from "@/lib/organization";

export const metadata = { title: "Support" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  await requireActiveOrganization();
  return <SupportView />;
}
