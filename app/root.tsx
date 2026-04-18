import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const meta: Route.MetaFunction = () => [
  { title: "Exotic - Ask Me Anything" },
  { name: "description", content: "Ask and answer questions anonymously. Connect with friends and discover new people on Exotic." },
  { property: "og:title", content: "Exotic - Ask Me Anything" },
  { property: "og:description", content: "Ask and answer questions anonymously. Connect with friends and discover new people." },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "theme-color", content: "#000000" },
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Space+Grotesk:wght@300..700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('exotic-theme') || 'light';
                if (theme === 'system') {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (theme === 'dark') document.documentElement.classList.add('dark');
                if (localStorage.getItem('exotic-liquid-glass') === '1') {
                  document.documentElement.classList.add('liquid-glass');
                }
              } catch(e) {}
            })();
          `
        }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { AuthProvider } from '~/components/auth-provider';
import { ToastContainer } from '~/components/toast';

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
      <ToastContainer />
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (error && error instanceof Error) {
    details = error.message;
    stack = import.meta.env.DEV ? error.stack : undefined;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center px-4">
        <h1 className="text-6xl font-black mb-4">{message}</h1>
        <p className="text-muted-foreground mb-8">{details}</p>
        {stack && (
          <pre className="w-full p-4 overflow-x-auto text-xs text-left bg-muted">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
