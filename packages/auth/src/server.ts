import { createAuth } from "./auth";

const authInstance = createAuth();
export { authInstance as auth };
export type Session = typeof authInstance.$Infer.Session;
