import { notFound } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Malformed ids 404 before the loading boundary streams (no DB call needed).
export default async function CandidateLayout({ children, params }: LayoutProps<"/candidates/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return children;
}
