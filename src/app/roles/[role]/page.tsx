import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RoleShortlist } from "@/components/RoleShortlist";
import { getRubric, ROLES, type Role } from "@/lib/db";
import { loadRows } from "@/lib/queries";

export default async function RolePage({ params }: PageProps<"/roles/[role]">) {
  const { role: raw } = await params;
  if (!ROLES.includes(raw as Role)) notFound();
  const role = raw as Role;
  await connection();
  const [rows, rubric] = await Promise.all([loadRows(), getRubric()]);
  return (
    <RoleShortlist
      role={role}
      criteria={rubric.filter((c) => c.role === role).map(({ id, name, weight, description }) => ({ id, name, weight, description }))}
      ranked={rows.filter((r) => r.appliedRole === role && r.status === "scored").sort((a, b) => a.rank! - b.rank!)}
      pending={rows.filter((r) => r.appliedRole === role && r.status !== "scored")}
    />
  );
}
