// The sign-in and sign-up pages: a short welcome beside the form (above it on a phone).
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <section className="auth-intro" aria-labelledby="auth-intro-h">
        <p className="eyebrow">TIME Inc. · Liberia</p>
        <h2 id="auth-intro-h">Learn, practise and qualify, wherever you are.</h2>
        <ul className="auth-points">
          <li><strong>Your classes in one place.</strong> Lessons, live sessions, assessments and results.</li>
          <li><strong>Study with little data.</strong> Save lessons on your phone and read them offline.</li>
          <li><strong>Fees and certificates.</strong> Pay by Mobile Money or bank, then request your certificate when you finish.</li>
        </ul>
        <p className="auth-back"><a href="https://tolbertinnovation-debug.github.io/TIME/">‹ Back to the TIME Inc. website</a></p>
      </section>
      {children}
    </div>
  );
}
