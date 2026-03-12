import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
// import { sdk } from "./sdk";

const GUEST_USER: User = {
  id: 1,
  openId: "guest",
  name: "Guest",
  email: "guest@local",
  loginMethod: "guest",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // TODO: 로그인 기능 복원 시 아래 주석을 해제하고 GUEST_USER 부분을 제거
  // let user: User | null = null;
  // try {
  //   user = await sdk.authenticateRequest(opts.req);
  // } catch (error) {
  //   user = null;
  // }
  return {
    req: opts.req,
    res: opts.res,
    user: GUEST_USER,
  };
}
