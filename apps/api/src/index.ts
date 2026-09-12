import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { createApp } from "./app";
import { readEnv } from "./env";
const env = readEnv(process.env);
if (env.SENTRY_DSN)
  Sentry.init({
    dsn: env.SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      delete event.extra;
      return event;
    },
  });
serve({ fetch: createApp(env).fetch, port: env.PORT }, () =>
  console.info(JSON.stringify({ event: "api_started", port: env.PORT })),
);
