import Link from "next/link";
import { redirect } from "next/navigation";
import { LessonForm } from "@/components/lesson-form";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";

export const metadata = { title: "Write a lesson" };

export default async function NewLesson({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { cls } = await requireClassStaff(id, "content.edit");
  const modules = await prisma.module.findMany({ where: { courseId: cls.courseId }, orderBy: { sort: "asc" } });
  if (!modules.length) redirect(`/teach/${id}/content`);
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack"><p className="small"><Link href={`/teach/${id}/content`}>Lessons</Link></p><h1>Write a lesson</h1><Notices params={await searchParams} /></div>
      <LessonForm classId={id} modules={modules} />
    </div>
  );
}
