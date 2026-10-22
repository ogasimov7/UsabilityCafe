import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TestBuilder } from "@/components/test-builder";
import { Empty, PageHeader } from "@/components/ui";

export default async function NewTest({ searchParams }: PageProps<"/designer/tests/new">) {
  const user = await requireUser("DESIGNER");
  const { project } = await searchParams;
  const projects = await db.project.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Post a test" sub="Like posting a job: describe the concept, set the pay per session, and testers pick it up from the job board." />
      {projects.length === 0 ? (
        <Empty>Create a project first on the <Link className="text-brand underline" href="/designer">dashboard</Link>.</Empty>
      ) : (
        <TestBuilder
          projects={projects}
          defaultProject={typeof project === "string" ? project : undefined}
        />
      )}
    </>
  );
}
