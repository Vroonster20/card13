import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isGuest: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    isGuest: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isGuest: boolean;
  }
}