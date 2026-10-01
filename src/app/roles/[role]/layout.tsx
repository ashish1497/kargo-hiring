import { notFound } from "next/navigation";
import { ROLES, type Role } from "@/lib/ranking";

// Validates the role above the loading boundary, so an unknown role is a real 404 rather than a
// streamed not-found inside a 200 response.
export default async function RoleLayout({ children, params }: LayoutProps<"/roles/[role]">) {
  const { role } = await params;
  if (!ROLES.includes(role as Role)) notFound();
  return children;
}
