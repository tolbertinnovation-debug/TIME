import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonForm } from "@/components/lesson-form";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";

export const metadata = { title: "Edit lesson" };

export default async function EditLesson({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, lessonId } = await params;
  const { cls } = await requireClassStaff(id, "content.edit");
  const [lesson, modules] = await Promise.all([
    prisma.lesson.findFirst({ where: { id: lessonId, status: "DRAFT", module: { courseId: cls.courseId } } }),
    prisma.module.findMany({ where: { courseId: cls.courseId }, orderBy: { sort: "asc" } }),
  ]);
  if (!lesson) notFound();
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack"><p className="small"><Link href={`/teach/${id}/content`}>Lessons</Link></p><h1>Edit lesson</h1><Notices params={await searchParams} /></div>
      <LessonForm classId={id} modules={modules} lesson={lesson} />
    </div>
  );
}
