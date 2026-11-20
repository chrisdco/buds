/**
 * Crash reporting (Sentry) and app performance (EAS Observe).
 *
 * Sentry: release builds only, and only when EXPO_PUBLIC_SENTRY_DSN is set
 * for the build's EAS environment, so local work never needs an account.
 * Errors only (no tracing) to stay inside the free plan.
 *
 * Observe: startup, per-screen render times and update downloads, sent from
 * release builds (debug metrics are dropped by default).
 *
 * Privacy: buds handles live location, so nothing location-shaped may leave
 * through either tool. No PII, no screenshots, no console or network
 * breadcrumbs (routing and search URLs carry coordinates), and route params
 * that identify rooms or people are stripped from navigation metrics.
 */
import type { ComponentType } from "react";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { Observe } from "expo-observe";
import * as Updates from "expo-updates";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/** Breadcrumb categories that can never carry a URL, a coordinate or a log line. */
const KEPT_BREADCRUMBS = new Set(["navigation", "touch", "ui.click", "app.lifecycle"]);

/** Route/query params dropped from navigation metrics. */
const PRIVATE_PARAMS = ["id", "uid", "code", "lat", "lng", "label", "name", "q"];

let sentryOn = false;

export function sentryEnabled(): boolean {
  return sentryOn;
}

/** Call once at module scope of the root layout, before anything renders. */
export function initMonitoring(): void {
  const channel = Updates.channel || "none";
  try {
    Observe.configure({
      environment: channel,
      integrations: { "expo-router": { filteredParams: PRIVATE_PARAMS } },
    });
  } catch {
    // Native module missing (Expo Go, web): metrics are simply off.
  }

  if (__DEV__ || !DSN || sentryOn) return;
  const version = Constants.expoConfig?.version ?? "0.0.0";
  Sentry.init({
    dsn: DSN,
    environment: channel,
    release: `buds@${version}`,
    dist: Updates.updateId ?? "embedded",
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    beforeBreadcrumb: (crumb) => (crumb.category && KEPT_BREADCRUMBS.has(crumb.category) ? crumb : null),
  });
  Sentry.setTag("runtime", Updates.runtimeVersion ?? "none");
  Sentry.setTag("ota", Updates.isEmbeddedLaunch ? "embedded" : "update");
  sentryOn = true;
}

/** Report a caught error with optional non-identifying context. No-op when disabled. */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>): void {
  if (!sentryOn) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

/** Wraps the root component so native crashes and touch breadcrumbs are captured. */
export function withMonitoring<P extends Record<string, unknown>>(component: ComponentType<P>): ComponentType<P> {
  return DSN && !__DEV__ ? (Sentry.wrap(component) as ComponentType<P>) : component;
}
