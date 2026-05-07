import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins/bearer';
import { db } from './db';
import * as schema from './db/schema';
import { config } from './config';

export const auth = betterAuth({
  appName: 'WB App',
  baseURL: config.appUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
    },
  },
  plugins: [
    bearer(), // Token-based auth for Expo mobile app
  ],
  trustedOrigins: config.trustedOrigins,
  advanced: {
    useSecureCookies: config.isProduction,
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
