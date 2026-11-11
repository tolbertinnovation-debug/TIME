// Browser builds only: the auth client imports all of `zod` (about 420 KB, mostly locale messages)
// to validate one small token response with z.object/z.string/z.number and .safeParse().
// Exporting just those from zod/mini keeps the account page light on phones.
import { object, string, number } from 'zod/mini';
export default { object, string, number };
export { object, string, number };
