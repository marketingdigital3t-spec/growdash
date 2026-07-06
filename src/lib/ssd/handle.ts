import { get, set, del } from "idb-keyval";

const HANDLE_KEY = "aria:ssd:handle";

// Guard for browsers without File System Access API (Safari, Firefox)
export function isFsAccessSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function loadStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const h = (await get(HANDLE_KEY)) as FileSystemDirectoryHandle | undefined;
    return h ?? null;
  } catch {
    return null;
  }
}

export async function requestHandle(): Promise<FileSystemDirectoryHandle> {
  // @ts-expect-error - showDirectoryPicker is not in default TS lib yet
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    id: "aria-ssd",
    mode: "readwrite",
    startIn: "documents",
  });
  await set(HANDLE_KEY, handle);
  return handle;
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  // @ts-expect-error - queryPermission not typed
  if ((await handle.queryPermission(opts)) === "granted") return true;
  // @ts-expect-error - requestPermission not typed
  return (await handle.requestPermission(opts)) === "granted";
}

export async function clearStoredHandle() {
  await del(HANDLE_KEY);
}
