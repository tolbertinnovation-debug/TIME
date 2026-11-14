import { nextCookies } from "better-auth/next-js";
import { createAuth } from "@/lib/auth-core";

export const auth = createAuth([nextCookies()]);
