"use client";

import { createContext, useContext } from "react";
import * as JapanData from "@/lib/japan-data";
import type { ProjectFn } from "@/types";

export const MapProjectionContext = createContext<ProjectFn | null>(null);

export function useMapProject(): ProjectFn {
  return useContext(MapProjectionContext) ?? JapanData.project;
}
