import { verifyCertificateAction } from "@/app/certificate-actions";
import { normaliseCode, normaliseNumber } from "@/lib/certificate";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Check a certificate" };

// Open to everyone: an employer or the Ministry can confirm a certificate without an account.
export default async function Verify({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const number = typeof params.number === "string" ? normaliseNumber(params.number).slice(0, 20) : "";
  const code = typeof params.code === "string" ? normaliseCode(params.code).slice(0, 12) : "";
  const asked = !!number && !!code;
  // Both the ID and the code must match, so certificates cannot be found by guessing ID numbers.
  const found = asked ? await prisma.certificate.findUnique({ where: { number } }) : null;
  const cert = found && found.code === code ? found : null;
  return (
    <div className="stack lg" style={{ maxWidth: 620, margin: "0 auto" }}>
      <div className="stack">
        <h1>Check a certificate</h1>
        <p className="muted">Enter the ID number and the code printed on a TIME Inc. certificate to confirm that it is genuine.</p>
      </div>
      {asked && (cert ? (
        <section className="card stack" aria-labelledby="result-h">
          <div className="row between"><h2 id="result-h">{cert.revokedAt ? "This certificate has been revoked" : "This certificate is genuine"}</h2><span className={`pill ${cert.revokedAt ? "bad" : "ok"}`}>{cert.revokedAt ? "Revoked" : "Valid"}</span></div>
          <div className="table-wrap"><table><tbody>
            <tr><th scope="row">ID number</th><td>{cert.number}</td></tr>
            <tr><th scope="row">Awarded to</th><td>{cert.holderName}</td></tr>
            <tr><th scope="row">Award</th><td>{cert.title}, {cert.field}</td></tr>
            <tr><th scope="row">Course</th><td>{cert.courseTitle}</td></tr>
            <tr><th scope="row">Awarded on</th><td>{formatDate(cert.awardedOn)}</td></tr>
            {cert.revokedAt && <tr><th scope="row">Revoked on</th><td>{formatDate(cert.revokedAt)}</td></tr>}
          </tbody></table></div>
          <p className="small muted">Issued by the Technical Institute for Many Empowerment (TIME) Inc., Liberia.</p>
        </section>
      ) : (
        <p className="notice error" role="alert">No certificate matches that ID number and code. Check both and try again, or contact TIME Inc. to confirm.</p>
      ))}
      <form className="card form" action={verifyCertificateAction}>
        <div className="field"><label htmlFor="number">ID number</label><input id="number" name="number" type="text" required maxLength={20} placeholder="TC-002" defaultValue={number} autoComplete="off" /></div>
        <div className="field"><label htmlFor="code">Code</label><input id="code" name="code" type="text" required maxLength={12} placeholder="7KQ2-M9XD" defaultValue={code} autoComplete="off" /></div>
        <div><button className="btn" type="submit">Check certificate</button></div>
      </form>
    </div>
  );
}
