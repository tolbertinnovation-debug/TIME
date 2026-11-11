// Messages passed back from an action through the address, e.g. /sign-in?error=...
export function Notices({ params }: { params: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : null);
  const error = one("error"), ok = one("ok");
  return (
    <>
      {error && <p className="notice error" role="alert">{error}</p>}
      {ok && <p className="notice ok" role="status">{ok}</p>}
    </>
  );
}
