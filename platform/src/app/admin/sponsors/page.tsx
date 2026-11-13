import Link from "next/link";
import { createSponsorAction } from "@/app/community-actions";
import { Notices } from "@/components/notice";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Sponsors" };

export default async function Sponsors({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCapability("sponsors.manage");
  const sponsors = await prisma.sponsor.findMany({ orderBy: { name: "asc" }, include: { sponsorships: true } });
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Sponsors</h1>
        <p className="muted">People and organisations who pay for a student's training. A sponsor does not sign in. With the student's consent, you send them a summary of the student's progress each term.</p>
        <Notices params={await searchParams} />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Sponsor</th><th>Contact</th><th>Students</th><th>Agreed to share</th></tr></thead>
        <tbody>
          {sponsors.map((s) => (
            <tr key={s.id}>
              <td><Link href={`/admin/sponsors/${s.id}`}><strong>{s.name}</strong></Link></td>
              <td>{s.contact ?? "—"}</td><td>{s.sponsorships.length}</td><td>{s.sponsorships.filter((x) => x.consentAt).length}</td>
            </tr>
          ))}
          {sponsors.length === 0 && <tr><td colSpan={4}>No sponsors yet.</td></tr>}
        </tbody>
      </table></div>
      <form className="card form" action={createSponsorAction}>
        <h2>Add a sponsor</h2>
        <div className="grid">
          <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" name="name" type="text" required maxLength={120} /></div>
          <div className="field"><label htmlFor="s-contact">Phone or email <span className="muted">(optional)</span></label><input id="s-contact" name="contact" type="text" maxLength={200} /></div>
        </div>
        <div className="field"><label htmlFor="s-notes">Notes <span className="muted">(optional)</span></label><input id="s-notes" name="notes" type="text" maxLength={500} /></div>
        <div><button className="btn" type="submit">Add sponsor</button></div>
      </form>
    </div>
  );
}
