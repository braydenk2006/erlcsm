import { requireStaffPage } from "@/lib/staff";
import { StaffPanel } from "@/components/staff/staff-panel";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const { role } = await requireStaffPage();
  return <StaffPanel role={role} />;
}
