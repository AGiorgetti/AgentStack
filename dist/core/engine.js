import path from "node:path";
import { promises as fs } from "node:fs";
import { applyManagedBlock, detectMalformedBlocks } from "./merge.js";
import { ensureDir, listWorkspaceFiles, readFileIfExists } from "./filesystem.js";
export async function discoverPacks(templateDir) {
    const neutralRoot = path.join(templateDir, "neutral");
    const vendorsRoot = path.join(templateDir, "vendors");
    const vendors = [];
    let neutral;
    const neutralDefinition = await readPackDefinition(path.join(neutralRoot, "pack.json"));
    if (neutralDefinition) {
        neutral = {
            kind: "neutral",
            id: neutralDefinition.id,
            rootDir: neutralRoot,
            definition: neutralDefinition,
        };
    }
    try {
        const vendorDirs = await fs.readdir(vendorsRoot, { withFileTypes: true });
        for (const dirent of vendorDirs) {
            if (!dirent.isDirectory()) {
                continue;
            }
            const vendorRoot = path.join(vendorsRoot, dirent.name);
            const definition = await readPackDefinition(path.join(vendorRoot, "pack.json"));
            if (!definition) {
                continue;
            }
            vendors.push({
                kind: "vendor",
                id: definition.id,
                rootDir: vendorRoot,
                definition,
            });
        }
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    return { neutral, vendors };
}
export async function listPacks(templateDir) {
    const { neutral, vendors } = await discoverPacks(templateDir);
    const definitions = [];
    if (neutral) {
        definitions.push(neutral.definition);
    }
    for (const vendor of vendors) {
        definitions.push(vendor.definition);
    }
    return definitions;
}
export async function planSelection(rootDir, templateDir, selection, managedBlocks, force) {
    const { neutral, vendors } = await discoverPacks(templateDir);
    const warnings = [];
    const errors = [];
    const selectedPacks = [];
    if (selection.includeNeutral) {
        if (!neutral) {
            errors.push("Neutral pack not found.");
        }
        else {
            selectedPacks.push(neutral);
        }
    }
    for (const vendorId of selection.vendors) {
        const vendor = vendors.find((item) => item.id === vendorId);
        if (!vendor) {
            errors.push(`Vendor pack '${vendorId}' not found.`);
            continue;
        }
        selectedPacks.push(vendor);
    }
    const plans = [];
    const workspaceFiles = await listWorkspaceFiles(rootDir);
    for (const pack of selectedPacks) {
        const files = await listTemplateFiles(pack.rootDir);
        for (const file of files) {
            if (path.basename(file) === "pack.json") {
                continue;
            }
            const relativePath = path.relative(pack.rootDir, file);
            const targetPath = normalizePath(relativePath);
            const exists = workspaceFiles.includes(targetPath);
            const isMarkdown = targetPath.endsWith(".md");
            let strategy = "create";
            if (exists && !force) {
                if (managedBlocks && isMarkdown) {
                    strategy = "managed-block";
                }
                else {
                    strategy = "skip";
                }
            }
            if (exists && force) {
                strategy = "overwrite";
            }
            plans.push({
                packId: pack.id,
                sourcePath: file,
                targetPath,
                strategy,
                blockId: managedBlocks && isMarkdown ? blockIdForPack(pack) : undefined,
            });
        }
    }
    if (warnings.length === 0 && errors.length === 0 && plans.length === 0) {
        warnings.push("No files matched the selected packs.");
    }
    return { plans, warnings, errors };
}
export async function applyPlan(rootDir, plans, options) {
    const counts = {
        created: 0,
        skipped: 0,
        updated: 0,
        overwritten: 0,
    };
    for (const plan of plans) {
        const targetPath = path.join(rootDir, plan.targetPath);
        if (plan.strategy === "skip") {
            console.log(`SKIP       ${plan.targetPath} (exists)`);
            counts.skipped += 1;
            continue;
        }
        const templateContent = await fs.readFile(plan.sourcePath, "utf8");
        if (plan.strategy === "create") {
            console.log(`CREATE     ${plan.targetPath}`);
            counts.created += 1;
            if (!options.dryRun) {
                await ensureDir(targetPath);
                await fs.writeFile(targetPath, templateContent, "utf8");
            }
            continue;
        }
        if (plan.strategy === "overwrite") {
            console.log(`OVERWRITE  ${plan.targetPath}`);
            counts.overwritten += 1;
            if (!options.dryRun) {
                await ensureDir(targetPath);
                await fs.writeFile(targetPath, templateContent, "utf8");
            }
            continue;
        }
        if (plan.strategy === "managed-block") {
            const existing = await readFileIfExists(targetPath);
            if (!existing) {
                console.log(`CREATE     ${plan.targetPath}`);
                counts.created += 1;
                if (!options.dryRun) {
                    await ensureDir(targetPath);
                    await fs.writeFile(targetPath, templateContent, "utf8");
                }
                continue;
            }
            const blockId = plan.blockId ?? "managed.block";
            const sanitized = stripManagedMarkers(templateContent);
            const result = applyManagedBlock(existing, blockId, sanitized);
            if (result.malformed) {
                console.log(`SKIP       ${plan.targetPath} (malformed managed block)`);
                counts.skipped += 1;
                continue;
            }
            console.log(`UPDATE     ${plan.targetPath} (managed blocks)`);
            counts.updated += 1;
            if (!options.dryRun) {
                await fs.writeFile(targetPath, result.content, "utf8");
            }
        }
    }
    console.log(`Summary: created=${counts.created} skipped=${counts.skipped} updated=${counts.updated} overwritten=${counts.overwritten}`);
}
export async function doctor(rootDir, templateDir, selection, managedBlocks) {
    const { plans, errors, warnings } = await planSelection(rootDir, templateDir, selection, managedBlocks, false);
    const workspaceFiles = await listWorkspaceFiles(rootDir);
    const resultWarnings = [...warnings];
    const resultErrors = [...errors];
    for (const plan of plans) {
        if (!workspaceFiles.includes(plan.targetPath)) {
            resultWarnings.push(`Missing file: ${plan.targetPath}`);
            continue;
        }
        if (managedBlocks && plan.targetPath.endsWith(".md")) {
            const content = await readFileIfExists(path.join(rootDir, plan.targetPath));
            if (content && detectMalformedBlocks(content)) {
                resultErrors.push(`Malformed managed blocks in ${plan.targetPath}`);
            }
            if (content && plan.blockId && !content.includes(`TEMPLATE:BEGIN ${plan.blockId}`)) {
                resultWarnings.push(`Missing managed block ${plan.blockId} in ${plan.targetPath}`);
            }
        }
    }
    return { warnings: resultWarnings, errors: resultErrors };
}
function normalizePath(p) {
    return p.split(path.sep).join("/");
}
async function listTemplateFiles(rootDir) {
    const files = [];
    async function walk(current) {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            }
            else {
                files.push(fullPath);
            }
        }
    }
    await walk(rootDir);
    return files;
}
async function readPackDefinition(packPath) {
    const raw = await readFileIfExists(packPath);
    if (!raw) {
        return null;
    }
    const parsed = JSON.parse(raw);
    return parsed;
}
function blockIdForPack(pack) {
    if (pack.kind === "neutral") {
        return "neutral.base";
    }
    return `vendor.${pack.id}`;
}
function stripManagedMarkers(content) {
    return content
        .split("\n")
        .filter((line) => !line.includes("TEMPLATE:BEGIN") && !line.includes("TEMPLATE:END"))
        .join("\n")
        .trim();
}
