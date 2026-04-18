import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Strictly protected routes (require authentication, no view mode)
  layout("routes/protected-layout.tsx", [
    route("inbox", "routes/inbox.tsx"),
    route("profile/:username", "routes/profile.$username.tsx"),
    route("notifications", "routes/notifications.tsx"),
    route("settings", "routes/settings.tsx"),
    route("search", "routes/search.tsx"),
    route("live", "routes/live.tsx"),
    route("live/:streamId", "routes/live.$streamId.tsx"),
    route("channels", "routes/channels.tsx", [
      index("routes/channels._index.tsx"),
      route(":handle", "routes/channels.$handle.tsx"),
    ]),
    route("owner-dashboard", "routes/owner-dashboard.tsx"),
    route("channels/invite/:code", "routes/channels.invite.$code.tsx"),
  ]),

  // View-mode routes (signed-out users can browse read-only)
  layout("routes/viewable-layout.tsx", [
    index("routes/home.tsx"),
    route("discover", "routes/discover.tsx"),
    route("posts", "routes/posts.tsx"),
    route("posts/:id", "routes/posts.$id.tsx"),
  ]),

  route("api/resolve-username", "routes/api.resolve-username.ts"),
  route("api/track-session", "routes/api.track-session.ts"),
  route("api/send-reset-code", "routes/api.send-reset-code.ts"),
  route("api/verify-reset-code", "routes/api.verify-reset-code.ts"),
  route("api/reset-password", "routes/api.reset-password.ts"),
  route("api/auth-email-hook", "routes/api.auth-email-hook.ts"),
  route("api/delete-account", "routes/api.delete-account.ts"),

  route("auth/confirm", "routes/auth-confirm.tsx"),

  // Public routes
  route("ask/:username", "routes/ask.$username.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("verify-reset-code", "routes/verify-reset-code.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
] satisfies RouteConfig;
