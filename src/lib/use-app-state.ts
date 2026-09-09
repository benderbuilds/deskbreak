"use client";

import { useSyncExternalStore } from "react";
import {
  getAppState,
  getServerAppState,
  subscribeAppState,
} from "./storage";
import type { AppState } from "./types";

export function useAppState(): AppState {
  return useSyncExternalStore(subscribeAppState, getAppState, getServerAppState);
}
