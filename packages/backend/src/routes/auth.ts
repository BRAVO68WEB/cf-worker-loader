import { Hono } from "hono";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";

const auth = new Hono<{ Variables: AuthVariables }>();

auth.post("/register", async (c) => {
  const body = (await c.req.json()) as { email?: string; password?: string; name?: string };
  if (!body.email || !body.password) {
    return c.json({ error: "email and password required" }, 400);
  }
  const email = body.email.toLowerCase().trim();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return c.json({ error: "email already registered" }, 409);
  }
  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    email,
    passwordHash,
    name: body.name ?? "",
  });
  const payload = { sub: String(user._id), email };
  const token = await signToken(payload);
  return c.json(
    { token, user: { id: payload.sub, email: payload.email } },
    201
  );
});

auth.post("/login", async (c) => {
  const body = (await c.req.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return c.json({ error: "email and password required" }, 400);
  }
  const user = await User.findOne({ email: body.email.toLowerCase().trim() }).lean();
  if (!user) {
    return c.json({ error: "invalid_credentials" }, 401);
  }
  const u = user as unknown as { _id: unknown; email: string; passwordHash: string };
  const match = await bcrypt.compare(body.password, u.passwordHash);
  if (!match) {
    return c.json({ error: "invalid_credentials" }, 401);
  }
  const payload = { sub: String(u._id), email: u.email };
  const token = await signToken(payload);
  return c.json({
    token,
    user: { id: payload.sub, email: payload.email },
  });
});

auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json({ user: { id: user.sub, email: user.email } });
});

export default auth;
