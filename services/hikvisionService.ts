/**
 * Hikvision (HikCentral Connect) client service — wraps httpsCallable.
 *
 * IMPORTANT: AK/SK are NEVER read from here. Keys live in `_private/hik`
 * (Firestore rules deny client reads). Status returns masked values (••••1234).
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

// ── Types ───────────────────────────────────────────────────────────────────

export interface HikStatus {
  ok: boolean;
  enabled: boolean;
  hasKeys: boolean;
  appKey: string | null;       // masked
  secretKey: string | null;    // masked
  debugKey: string | null;
  baseUrl: string;
  centerId: string | null;
  groupId: string | null;
  accessLevelId: string | null;
  mqSubscribedAt: string | null;
  areaDomain: string | null;
  lastPollAt: string | null;
  lastEventAt: string | null;
  lastError: string | null;
  linkedEmployees: number;
}

export interface HikConfigInput {
  appKey?: string;
  secretKey?: string;
  debugKey?: string;
  baseUrl?: string;
  centerId?: string;
  groupId?: string;
  accessLevelId?: string;
  enabled?: boolean;
  tzOffsetMin?: number;
}

export interface HikEnrollResult {
  ok: boolean;
  info?: string;
  error?: string;
  employeeNo?: string;
  personId?: string | null;
  created?: boolean;
  faceUploaded?: boolean;
  deviceApplied?: boolean;
  pushedToDevices?: boolean;
  accessLevelName?: string;
  headPicUrl?: string | null;
}

export interface HikDevice {
  id: string;
  name: string;
  model: string;
  serialNo: string;
  online: boolean;
  isTerminal: boolean;
}

export interface HikDevicesResult {
  ok: boolean;
  configured: boolean;
  error?: string;
  devices: HikDevice[];
  terminals: HikDevice[];
  anyTerminalOnline?: boolean;
  onlineTerminal?: HikDevice | null;
}

export interface HikTestResult {
  ok: boolean;
  token?: boolean;
  areaDomain?: string;
  devices?: number;
  terminals?: number;
  onlineTerminal?: string | null;
  subscribed?: boolean;
  levels?: { id: string; name: string }[];
  groups?: { id: string; name: string }[];
  accessLevelId?: string | null;
  accessLevelName?: string | null;
  groupId?: string;
  info?: string;
  error?: string;
}

export interface HikSaveResult {
  ok: boolean;
  saved: string[];
  verified?: boolean;
  areaDomain?: string;
  info?: string;
}

// ── API calls ───────────────────────────────────────────────────────────────

/** Save config keys (appKey/secretKey). Verifies immediately if keys changed. */
export const saveHikConfig = async (cfg: HikConfigInput): Promise<HikSaveResult> =>
  (await httpsCallable(functions, "hikSaveConfig")({ ...cfg })).data as HikSaveResult;

/** Get masked status: are keys set, last poll time, errors, linked staff count. */
export const getHikStatus = async (): Promise<HikStatus> =>
  (await httpsCallable(functions, "hikStatus")({})).data as HikStatus;

/** Test full connection: token → devices → MQ subscribe → access levels. */
export const testHik = async (): Promise<HikTestResult> =>
  (await httpsCallable(functions, "hikTest")({})).data as HikTestResult;

/** Enroll a staff member's face (photo + person card → device sync). */
export const enrollFace = async (uid: string): Promise<HikEnrollResult> =>
  (await httpsCallable(functions, "hikEnrollFace")({ uid })).data as HikEnrollResult;

/** Get device list with online status — used for the terminal status badge. */
export const getHikDevices = async (): Promise<HikDevicesResult> =>
  (await httpsCallable(functions, "hikDevices")({})).data as HikDevicesResult;
