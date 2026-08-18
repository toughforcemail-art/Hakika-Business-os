"use client";

import { Suspense, type ComponentType, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AccessProvider as FinanceAccessProvider } from "@/legacy/finance/context/AccessContext";
import { AccessProvider as HrAccessProvider } from "@/legacy/hr/context/AccessContext";
import { AccessProvider as RealEstateAccessProvider } from "@/legacy/real-estate/context/AccessContext";
import { AccessProvider as ToughForceAccessProvider } from "@/legacy/toughforce/context/AccessContext";
import { pageLoaders } from "@/modules/page-loaders";
import { originalRouteToSlug } from "@/modules/original-route-map";

function pageKey(module: string, section: string[]) {
  return module === "toughforce" ? "toughforce" : module;
}

function loaderSlug(module: string, section: string[]) {
  const route = `/app/${module}/${section.join("/")}`;
  return originalRouteToSlug[module]?.[route] ?? section.at(-1) ?? "dashboard";
}

function ModuleAccessProvider({ module, children }: { module: string; children: ReactNode }) {
  if (module === "real-estate") return <RealEstateAccessProvider>{children}</RealEstateAccessProvider>;
  if (module === "finance") return <FinanceAccessProvider>{children}</FinanceAccessProvider>;
  if (module === "toughforce") return <ToughForceAccessProvider>{children}</ToughForceAccessProvider>;
  return <HrAccessProvider>{children}</HrAccessProvider>;
}

export function hasLegacyPage(module: string, section: string[]) {
  return Boolean(pageLoaders[pageKey(module, section)]?.[loaderSlug(module, section)]);
}

export function LegacyPageRenderer({ module, section }: { module: string; section: string[] }) {
  const Page = pageLoaders[pageKey(module, section)]?.[loaderSlug(module, section)] as ComponentType<any> | undefined;
  if (!Page) return null;
  return <div className="legacy-page-content"><MemoryRouter initialEntries={[`/app/${module}/${section.join("/")}`]}><ModuleAccessProvider module={module}><Suspense fallback={<div className="legacy-loading">Loading extracted workspace page…</div>}><Page /></Suspense></ModuleAccessProvider></MemoryRouter></div>;
}
