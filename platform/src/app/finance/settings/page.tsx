import { savePaymentDetailsAction } from "@/app/finance-actions";
import { Notices } from "@/components/notice";
import { paymentDetails } from "@/lib/fees-data";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Payment details" };

export default async function PaymentDetails({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCapability("finance.manage");
  const details = await paymentDetails();
  return (
    <div className="stack lg" style={{ maxWidth: 680 }}>
      <div className="stack">
        <h1>Payment details</h1>
        <p className="muted">Students see these on their Fees page when they have something to pay. Check every digit: students will send money to what is written here. Each change is recorded in the activity log.</p>
        <Notices params={await searchParams} />
      </div>
      <form className="card form" action={savePaymentDetailsAction}>
        <div className="field"><label htmlFor="mobileMoney">Mobile Money</label><textarea id="mobileMoney" name="mobileMoney" maxLength={500} defaultValue={details.mobileMoney} aria-describedby="mm-hint" /><span className="hint" id="mm-hint">The number, the network and the account name.</span></div>
        <div className="field"><label htmlFor="bank">Bank transfer</label><textarea id="bank" name="bank" maxLength={500} defaultValue={details.bank} aria-describedby="bank-hint" /><span className="hint" id="bank-hint">The bank, branch, account name and account number.</span></div>
        <div><button className="btn" type="submit">Save payment details</button></div>
      </form>
    </div>
  );
}
