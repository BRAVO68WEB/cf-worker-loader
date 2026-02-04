import * as jose from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "orcratration-dev-secret-min-32-chars"
);

const alg = "HS256";

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export async function signToken(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, secret, { algorithms: [alg] });
  return payload as unknown as JwtPayload;
}
