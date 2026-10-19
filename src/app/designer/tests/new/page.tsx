import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TestBuilder } from "@/components/test-builder";
import { Empty, PageHeader } from "@/components/ui";
import { PLANS, SPECIALIST_PRICE_CENTS, type PlanKey } from "@/lib/rules";

export default async function NewTest({ searchParams }: PageProps<"/designer/tests/new">) {
  const user = await requireUser("DESIGNER");
  const { project } = await searchParams;
  const projects = await db.project.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="New test" sub="Set up the concept, tasks and who should test it." />
      {projects.length === 0 ? (
        <Empty>Create a project first on the <Link className="text-brand underline" href="/designer">dashboard</Link>.</Empty>
      ) : (
        <TestBuilder
          projects={projects}
          defaultProject={typeof project === "string" ? project : undefined}
          unitCents={PLANS[user.plan as PlanKey].sessionCents}
          specialistCents={SPECIALIST_PRICE_CENTS}
          credits={user.sessionCredits}
          plan={user.plan}
        />
      )}
    </>
  );
}
