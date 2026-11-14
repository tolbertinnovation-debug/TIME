import Link from "next/link";
import { notFound } from "next/navigation";
import { Transcript } from "@/components/transcript";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Transcript" };

// The Registrar, academic leadership and administrators can open any student's transcript, for example to sign it.
export default async function StudentTranscript({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await requireCapability("records.view");
  const { userId } = await params;
  const student = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (!student || student.role !== "STUDENT") notFound();
  await audit({ actor: viewer, action: "transcript.viewed", summary: `${viewer.name} opened the transcript of ${student.name}`, entityType: "user", entityId: userId });
  return (
    <div className="stack lg">
      <p className="small no-print"><Link href="/admin/users">Accounts</Link></p>
      <Transcript userId={userId} />
    </div>
  );
}
