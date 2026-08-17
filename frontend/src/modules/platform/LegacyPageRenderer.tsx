"use client";

import { Suspense, type ComponentType } from "react";
import { MemoryRouter } from "react-router-dom";
import { AccessProvider } from "@/legacy/hr/context/AccessContext";
import { pageLoaders } from "@/modules/page-loaders";
import { originalRouteToSlug } from "@/modules/original-route-map";

function pageKey(module: string, section: string[]) {
  return module === "toughforce" ? "toughforce" : module;
}

function loaderSlug(module: string, section: string[]) {
  const route = `/app/${module}/${section.join("/")}`;
  return originalRouteToSlug[module]?.[route] ?? section.at(-1) ?? "dashboard";
}

export function hasLegacyPage(module: string, section: string[]) {
  return Boolean(pageLoaders[pageKey(module, section)]?.[loaderSlug(module, section)]);
}

export function LegacyPageRenderer({ module, section }: { module: string; section: string[] }) {
  const Page = pageLoaders[pageKey(module, section)]?.[loaderSlug(module, section)] as ComponentType<any> | undefined;
  if (!Page) return null;
  return <div className="legacy-page-content"><MemoryRouter initialEntries={[`/app/${module}/${section.join("/")}`]}><AccessProvider><Suspense fallback={<div className="legacy-loading">Loading extracted workspace page…</div>}><Page /></Suspense></AccessProvider></MemoryRouter></div>;
}
