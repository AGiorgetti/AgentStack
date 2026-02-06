import { promises as fs } from "node:fs";
import path from "node:path";

export async function ensureDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function listWorkspaceFiles(rootDir: string): Promise<string[]> {
  const entries: string[] = [];
  async function walk(current: string): Promise<void> {
    const items = await fs.readdir(current, { withFileTypes: true });
    for (const item of items) {
      if (item.name === ".git") {
        continue;
      }
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        await walk(fullPath);
      } else {
        entries.push(path.relative(rootDir, fullPath));
      }
    }
  }

  await walk(rootDir);
  return entries.sort();
}
