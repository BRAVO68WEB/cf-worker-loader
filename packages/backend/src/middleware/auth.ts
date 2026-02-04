import { createMiddleware } from "hono/factory";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";

export type AuthVariables = { user: JwtPayload };

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return c.json({ error: "unauthorized", message: "Missing or invalid Authorization header" }, 401);
  }
  try {
    const payload = await verifyToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }
});
