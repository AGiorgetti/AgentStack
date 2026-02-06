import { promises as fs } from "node:fs";
import path from "node:path";
export async function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}
export async function readFileIfExists(filePath) {
    try {
        return await fs.readFile(filePath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
export async function listWorkspaceFiles(rootDir) {
    const entries = [];
    async function walk(current) {
        const items = await fs.readdir(current, { withFileTypes: true });
        for (const item of items) {
            if (item.name === ".git") {
                continue;
            }
            const fullPath = path.join(current, item.name);
            if (item.isDirectory()) {
                await walk(fullPath);
            }
            else {
                entries.push(path.relative(rootDir, fullPath));
            }
        }
    }
    await walk(rootDir);
    return entries.sort();
}
