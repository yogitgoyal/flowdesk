import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// This seed script intentionally creates no demo data.
// The app is designed to work entirely from real registrations —
// a new user signs up via /login (Sign up tab), which calls
// /api/auth/register, and can then create their own workspace
// and project from a genuinely empty state.
//
// This file still needs to exist and run cleanly (Prisma calls it
// after every migrate/reset), but it deliberately does nothing except
// wipe any existing data, using Prisma's own client so it works
// identically regardless of the underlying database provider.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Wipe in dependency order — ensures a clean slate even if old
  // demo data exists from before this file was emptied out.
  await prisma.activity.deleteMany();
  await prisma.taskVersion.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskLabel.deleteMany();
  await prisma.label.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceInvite.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database wiped clean. No demo data seeded.");
  console.log("Register a real account at /login to get started.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });