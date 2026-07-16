import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const adminMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, role: "ADMIN" },
  });

  if (!adminMembership) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
