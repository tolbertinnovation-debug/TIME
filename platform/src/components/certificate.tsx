import Image from "next/image";
import { ADDRESS, awardedPhrase, INSTITUTION, PLACE, SIGNATURES, WORDING, type Wording } from "@/lib/certificate";

type Cert = { number: string; code: string; holderName: string; title: string; field: string; wording: string; awardedOn: Date; revokedAt: Date | null };

// The certificate as it prints. Signature lines are left blank to be signed by hand.
export function CertificateView({ cert }: { cert: Cert }) {
  const wording: Wording = cert.wording === "TEACHING" ? "TEACHING" : "GENERAL";
  return (
    <div className="cert-frame">
      <div className="cert">
        <div className="cert-head">{INSTITUTION}</div>
        <div className="cert-address">{ADDRESS}</div>
        <div className="cert-banner">{cert.title}</div>
        <Image className="cert-logo" src="/logo.png" alt="TIME Inc. logo" width={128} height={128} priority />
        <div className="cert-field">{cert.field}</div>
        <div className="cert-name">{cert.holderName}</div>
        <p className="cert-body">{WORDING[wording]}</p>
        <p className="cert-awarded">Awarded this {awardedPhrase(cert.awardedOn)} in {PLACE}</p>
        <div className="cert-signs">
          {SIGNATURES[wording].map((s) => (
            <div key={s.label}>
              <div className="line">{s.label}: <span /></div>
              {s.lines.map((l) => <p key={l}>{l}</p>)}
            </div>
          ))}
        </div>
        <div className="cert-foot">
          <div className="cert-code">Check this certificate online with<br />ID {cert.number} and code {cert.code}</div>
          <div className="cert-id">ID NO: {cert.number}</div>
        </div>
        {cert.revokedAt && <div className="cert-revoked" aria-label="This certificate has been revoked">REVOKED</div>}
      </div>
    </div>
  );
}

export function Checklist({ checks }: { checks: { label: string; met: boolean; detail: string }[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.label}>
          <span className={`mark ${c.met ? "met" : ""}`} aria-hidden="true">{c.met ? "✓" : "✕"}</span>
          <span><strong>{c.label}</strong> <span className="skip">{c.met ? "(met)" : "(not met)"}</span><br /><span className="muted small">{c.detail}</span></span>
        </li>
      ))}
    </ul>
  );
}
