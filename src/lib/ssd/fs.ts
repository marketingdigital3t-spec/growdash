// Small filesystem helpers on top of FileSystemDirectoryHandle.

export async function getOrCreateDir(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return root.getDirectoryHandle(name, { create: true });
}

export async function* walkFiles(
  dir: FileSystemDirectoryHandle,
  path = "",
): AsyncGenerator<{ path: string; handle: FileSystemFileHandle }> {
  for await (const [name, handle] of (
    dir as unknown as {
      entries: () => AsyncIterable<[string, FileSystemHandle]>;
    }
  ).entries()) {
    const nextPath = path ? `${path}/${name}` : name;
    if (handle.kind === "file") {
      yield { path: nextPath, handle: handle as FileSystemFileHandle };
    } else {
      yield* walkFiles(handle as FileSystemDirectoryHandle, nextPath);
    }
  }
}

export async function readText(handle: FileSystemFileHandle): Promise<string> {
  const f = await handle.getFile();
  return f.text();
}

export async function readPdfText(handle: FileSystemFileHandle): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Vite bundles the worker via `?url`
  const workerUrl = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default as string;
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    workerUrl;

  const file = await handle.getFile();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  return text;
}

export async function writeJson(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: unknown,
): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function readJson<T>(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<T | null> {
  try {
    const fh = await dir.getFileHandle(name);
    const text = await (await fh.getFile()).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function deleteFile(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch {
    // no-op
  }
}

export async function listFiles(
  dir: FileSystemDirectoryHandle,
  suffix?: string,
): Promise<string[]> {
  const out: string[] = [];
  for await (const [name, handle] of (
    dir as unknown as {
      entries: () => AsyncIterable<[string, FileSystemHandle]>;
    }
  ).entries()) {
    if (handle.kind !== "file") continue;
    if (suffix && !name.endsWith(suffix)) continue;
    out.push(name);
  }
  return out;
}
