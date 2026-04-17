import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Protected routes (require authentication)
  layout("routes/protected-layout.tsx", [
    index("routes/home.tsx"),
    route("inbox", "routes/inbox.tsx"),
    route("profile/:username", "routes/profile.$username.tsx"),
    route("discover", "routes/discover.tsx"),
    route("notifications", "routes/notifications.tsx"),
    route("settings", "routes/settings.tsx"),
    route("search", "routes/search.tsx"),
    route("posts", "routes/posts.tsx"),
    route("live", "routes/live.tsx"),
    route("live/:streamId", "routes/live.$streamId.tsx"),
    route("owner-dashboard", "routes/owner-dashboard.tsx"),
  ]),

  // Temporary showcase
  route("showcase", "routes/showcase.tsx"),
  route("api/resolve-username", "routes/api.resolve-username.ts"),
  route("api/track-session", "routes/api.track-session.ts"),

  // Public routes
  route("ask/:username", "routes/ask.$username.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
] satisfies RouteConfig;
