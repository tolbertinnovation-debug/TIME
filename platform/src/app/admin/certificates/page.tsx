import Link from "next/link";
import { revokeCertificateAction, saveNumberingAction } from "@/app/certificate-actions";
import { Notices } from "@/components/notice";
import { PREFIXES } from "@/lib/certificate";
import { lastPaperKey } from "@/lib/certificate-data";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Certificates" };

const PREFIX_LABEL = { TC: "Teaching certificates (TC)", DP: "Diplomas (DP)", PC: "Professional certificates (PC)", CT: "Other certificates (CT)" } as const;

export default async function AdminCertificates({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("certificates.view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const [certs, settings] = await Promise.all([
    prisma.certificate.findMany({
      where: q ? { OR: [{ holderName: { contains: q, mode: "insensitive" } }, { number: { contains: q, mode: "insensitive" } }] } : {},
      orderBy: { createdAt: "desc" }, take: 200,
    }),
    prisma.setting.findMany({ where: { key: { in: PREFIXES.map(lastPaperKey) } } }),
  ]);
  const last = (p: string) => settings.find((s) => s.key === lastPaperKey(p))?.value ?? "0";
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Certificates</h1>
        <Notices params={params} />
        <form className="inline-form" method="get" role="search">
          <label className="skip" htmlFor="q">Search by name or ID number</label>
          <input id="q" name="q" type="search" placeholder="Name or ID number" defaultValue={q} />
          <button className="btn sm" type="submit">Search</button>
        </form>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>ID number</th><th>Awarded to</th><th>Award</th><th>Awarded on</th><th>Issued by</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {certs.map((c) => (
            <tr key={c.id}>
              <td className="nowrap"><Link href={`/certificates/${c.id}`}><strong>{c.number}</strong></Link></td>
              <td>{c.holderName}</td>
              <td>{c.title}, {c.field}</td>
              <td className="nowrap">{formatDate(c.awardedOn)}</td>
              <td>{c.issuedByName}</td>
              <td><span className={`pill ${c.revokedAt ? "bad" : "ok"}`}>{c.revokedAt ? "Revoked" : "Valid"}</span>{c.revokeReason ? <><br /><span className="small">{c.revokeReason}</span></> : null}</td>
              <td>
                {!c.revokedAt && can(me.role, "certificates.revoke") && (
                  <details>
                    <summary className="small">Revoke</summary>
                    <form className="inline-form" action={revokeCertificateAction} style={{ marginTop: 6 }}>
                      <input type="hidden" name="certificateId" value={c.id} />
                      <label className="skip" htmlFor={`reason-${c.id}`}>Reason</label>
                      <input id={`reason-${c.id}`} name="reason" type="text" required minLength={10} maxLength={500} placeholder="Reason" />
                      <button className="btn danger sm" type="submit">Revoke certificate</button>
                    </form>
                  </details>
                )}
              </td>
            </tr>
          ))}
          {certs.length === 0 && <tr><td colSpan={7}>{q ? "No certificates match." : "No certificates have been issued on the platform yet."}</td></tr>}
        </tbody>
      </table></div>
      {can(me.role, "certificates.numbering") && (
        <form className="card form" action={saveNumberingAction}>
          <h2>Last number issued on paper</h2>
          <p className="muted small">TIME has already issued certificates on paper. Enter the last number used for each kind, so the platform continues from the next one and no two certificates share an ID. Enter 0 if none were issued.</p>
          <div className="grid">
            {PREFIXES.map((p) => (
              <div className="field" key={p}><label htmlFor={`last-${p}`}>{PREFIX_LABEL[p]}</label><input id={`last-${p}`} name={`last-${p}`} type="text" inputMode="numeric" maxLength={6} defaultValue={last(p)} /></div>
            ))}
          </div>
          <div><button className="btn ghost" type="submit">Save numbers</button></div>
        </form>
      )}
    </div>
  );
}
