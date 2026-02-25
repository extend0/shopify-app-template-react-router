import type { D1Database } from "@cloudflare/workers-types";
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

type ShopifyEnv = {
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SCOPES?: string;
  SHOPIFY_APP_URL?: string;
  SHOP_CUSTOM_DOMAIN?: string;
};

type ShopifyBindings = ShopifyEnv & { DB?: D1Database };

// Global state for the CF worker isolate
declare global {
  var shopifyDb: D1Database | undefined;
  // eslint-disable-next-line no-var
  var shopifyAppInstance: ReturnType<typeof shopifyApp> | undefined;
  // eslint-disable-next-line no-var
  var shopifyEnv: ShopifyEnv | undefined;
}

// D1-backed session storage — replaces PrismaSessionStorage
class D1SessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return false;
    }

    try {
      const userInfo = session.onlineAccessInfo
        ? {
            userId: session.onlineAccessInfo.associated_user?.id || null,
            firstName:
              session.onlineAccessInfo.associated_user?.first_name || null,
            lastName:
              session.onlineAccessInfo.associated_user?.last_name || null,
            email: session.onlineAccessInfo.associated_user?.email || null,
            accountOwner: session.onlineAccessInfo.associated_user
              ?.account_owner
              ? 1
              : 0,
            locale: session.onlineAccessInfo.associated_user?.locale || null,
            collaborator: session.onlineAccessInfo.associated_user?.collaborator
              ? 1
              : 0,
            emailVerified: session.onlineAccessInfo.associated_user
              ?.email_verified
              ? 1
              : 0,
          }
        : {
            userId: null,
            firstName: null,
            lastName: null,
            email: null,
            accountOwner: 0,
            locale: null,
            collaborator: 0,
            emailVerified: 0,
          };

      await db
        .prepare(
          `INSERT OR REPLACE INTO sessions
          (id, shop, state, isOnline, scope, accessToken, expires,
           userId, firstName, lastName, email, accountOwner, locale,
           collaborator, emailVerified, refreshToken, refreshTokenExpires)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          session.id || null,
          session.shop || null,
          session.state || null,
          session.isOnline ? 1 : 0,
          session.scope || null,
          session.accessToken || null,
          session.expires ? session.expires.getTime() : null,
          userInfo.userId,
          userInfo.firstName,
          userInfo.lastName,
          userInfo.email,
          userInfo.accountOwner,
          userInfo.locale,
          userInfo.collaborator,
          userInfo.emailVerified,
          session.refreshToken || null,
          session.refreshTokenExpires
            ? session.refreshTokenExpires.getTime()
            : null
        )
        .run();
      return true;
    } catch (error) {
      console.error("Failed to store session:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return undefined;
    }

    try {
      const result = await db
        .prepare(`SELECT * FROM sessions WHERE id = ?`)
        .bind(id || null)
        .first();

      if (!result) return undefined;

      const session = new Session({
        id: result.id as string,
        shop: result.shop as string,
        state: result.state as string,
        isOnline: Boolean(result.isOnline),
      });

      session.scope = result.scope as string;
      session.accessToken = result.accessToken as string;

      if (result.expires) {
        session.expires = new Date(result.expires as number);
      }
      if (result.refreshToken) {
        session.refreshToken = result.refreshToken as string;
      }
      if (result.refreshTokenExpires) {
        session.refreshTokenExpires = new Date(
          result.refreshTokenExpires as number
        );
      }

      if (result.userId) {
        session.onlineAccessInfo = {
          expires_in: result.expires
            ? Math.floor(((result.expires as number) - Date.now()) / 1000)
            : 0,
          associated_user_scope: result.scope as string,
          associated_user: {
            id: result.userId as number,
            first_name: result.firstName as string,
            last_name: result.lastName as string,
            email: result.email as string,
            account_owner: Boolean(result.accountOwner),
            locale: result.locale as string,
            collaborator: Boolean(result.collaborator),
            email_verified: Boolean(result.emailVerified),
          },
        };
      }

      return session;
    } catch (error) {
      console.error("Failed to load session:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return false;
    }

    try {
      await db
        .prepare(`DELETE FROM sessions WHERE id = ?`)
        .bind(id || null)
        .run();
      return true;
    } catch (error) {
      console.error("Failed to delete session:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return false;
    }

    try {
      for (const id of ids) {
        await this.deleteSession(id);
      }
      return true;
    } catch (error) {
      console.error("Failed to delete sessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return [];
    }

    try {
      const results = await db
        .prepare(`SELECT * FROM sessions WHERE shop = ?`)
        .bind(shop || null)
        .all();

      return results.results.map((result: Record<string, unknown>) => {
        const session = new Session({
          id: result.id as string,
          shop: result.shop as string,
          state: result.state as string,
          isOnline: Boolean(result.isOnline),
        });

        session.scope = result.scope as string;
        session.accessToken = result.accessToken as string;

        if (result.expires) {
          session.expires = new Date(result.expires as number);
        }
        if (result.refreshToken) {
          session.refreshToken = result.refreshToken as string;
        }
        if (result.refreshTokenExpires) {
          session.refreshTokenExpires = new Date(
            result.refreshTokenExpires as number
          );
        }

        if (result.userId) {
          session.onlineAccessInfo = {
            expires_in: result.expires
              ? Math.floor(((result.expires as number) - Date.now()) / 1000)
              : 0,
            associated_user_scope: result.scope as string,
            associated_user: {
              id: result.userId as number,
              first_name: result.firstName as string,
              last_name: result.lastName as string,
              email: result.email as string,
              account_owner: Boolean(result.accountOwner),
              locale: result.locale as string,
              collaborator: Boolean(result.collaborator),
              email_verified: Boolean(result.emailVerified),
            },
          };
        }

        return session;
      });
    } catch (error) {
      console.error("Failed to find sessions by shop:", error);
      return [];
    }
  }
}

const sessionStorage = new D1SessionStorage();

// Lazy-init: shopifyApp cannot be created at module load time because
// CF env vars (API key, secret, etc.) are only available per-request.
function getShopifyApp() {
  if (!globalThis.shopifyAppInstance) {
    const env = globalThis.shopifyEnv || {};

    globalThis.shopifyAppInstance = shopifyApp({
      apiKey: env.SHOPIFY_API_KEY || "",
      apiSecretKey: env.SHOPIFY_API_SECRET || "",
      apiVersion: ApiVersion.October25,
      scopes: env.SCOPES?.split(","),
      appUrl: env.SHOPIFY_APP_URL || "",
      authPathPrefix: "/auth",
      sessionStorage,
      distribution: AppDistribution.AppStore,
      future: {
        expiringOfflineAccessTokens: true,
      },
      ...(env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] }
        : {}),
    });
  }
  return globalThis.shopifyAppInstance!;
}

// Called from workers/app.ts on every request with the CF env binding.
// Uses a loose type so it works with the CF Env type without importing it here.
export function setupShopify(env: ShopifyBindings) {
  if (env && !globalThis.shopifyEnv) {
    globalThis.shopifyEnv = env;
  }
  if (env?.DB && !globalThis.shopifyDb) {
    globalThis.shopifyDb = env.DB;
  }
}

export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = (...args: Parameters<ReturnType<typeof shopifyApp>["addDocumentResponseHeaders"]>) =>
  getShopifyApp().addDocumentResponseHeaders(...args);
export const authenticate = new Proxy({} as ReturnType<typeof shopifyApp>["authenticate"], {
  get(_, prop: string | symbol) {
    return (getShopifyApp().authenticate as unknown as Record<string | symbol, unknown>)[prop];
  },
});
export const unauthenticated = new Proxy({} as ReturnType<typeof shopifyApp>["unauthenticated"], {
  get(_, prop: string | symbol) {
    return (getShopifyApp().unauthenticated as unknown as Record<string | symbol, unknown>)[prop];
  },
});
export const login = (...args: Parameters<ReturnType<typeof shopifyApp>["login"]>) =>
  getShopifyApp().login(...args);
export const registerWebhooks = (...args: Parameters<ReturnType<typeof shopifyApp>["registerWebhooks"]>) =>
  getShopifyApp().registerWebhooks(...args);

export default {
  apiVersion,
  authenticate,
  unauthenticated,
  login,
  registerWebhooks,
  addDocumentResponseHeaders,
};
