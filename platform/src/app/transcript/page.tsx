import Link from "next/link";
import { Transcript } from "@/components/transcript";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "My transcript" };

export default async function MyTranscript() {
  const user = await requireCapability("classes.apply");
  return (
    <div className="stack lg">
      <div className="stack no-print">
        <p className="small"><Link href="/certificates">Certificates</Link></p>
        <p className="muted">Use your browser&apos;s print or save option for a copy. For an official copy, ask the Registrar to sign and stamp it.</p>
      </div>
      <Transcript userId={user.id} />
    </div>
  );
}
