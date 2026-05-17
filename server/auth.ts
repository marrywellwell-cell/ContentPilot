import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  // 메모리 세션 사용 — DB 연결 부하 제거 (Render 무료 플랜 안정성 향상)
  return session({
    secret: process.env.SESSION_SECRET || "contentflow-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || "";
            const user = await storage.upsertUser({
              id: profile.id,
              email,
              firstName: profile.name?.givenName || null,
              lastName: profile.name?.familyName || null,
              profileImageUrl: profile.photos?.[0]?.value || null,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
  } else {
    console.warn("[auth] GOOGLE_CLIENT_ID/SECRET 미설정 — 개발 모드: 자동 로그인 활성화");
  }

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      cb(null, user || null);
    } catch (err) {
      cb(err);
    }
  });

  // 개발 모드: Google 인증 없이 자동 로그인
  if (!process.env.GOOGLE_CLIENT_ID) {
    app.get("/api/login", async (req, res) => {
      const devUser = await storage.upsertUser({
        id: "dev-user-001",
        email: "dev@contentpilot.local",
        firstName: "개발자",
        lastName: null,
        profileImageUrl: null,
      });
      req.login(devUser, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.redirect("/");
      });
    });
  } else {
    app.get("/api/login", passport.authenticate("google", { scope: ["openid", "email", "profile"] }));
  }

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (_req, res) => res.redirect("/")
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });

  // Keep legacy /api/callback for compatibility
  app.get("/api/callback", (_req, res) => res.redirect("/api/login"));
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};

export const isAuthenticatedOrApiKey: RequestHandler = async (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("cf_")) {
      try {
        const apiKey = await storage.getApiKeyByKey(token);
        if (apiKey) {
          req.user = await storage.getUser(apiKey.userId);
          req.apiKeyUsed = token;
          storage.touchApiKey(token).catch(() => {});
          return next();
        }
      } catch { /* fall through */ }
    }
    return res.status(401).json({ message: "Invalid API key" });
  }

  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!user?.id) return res.status(401).json({ message: "Unauthorized" });

  const dbUser = await storage.getUser(user.id);
  if (!dbUser?.isAdmin) return res.status(403).json({ message: "Forbidden: Admin access required" });

  return next();
};
