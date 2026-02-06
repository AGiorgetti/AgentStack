import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { applyPlan, discoverPacks, doctor as runDoctor, listPacks, planSelection, } from "./core/engine.js";
const rootDir = process.cwd();
const command = process.argv[2] ?? "help";
async function main() {
    if (command === "list") {
        await handleList();
        return;
    }
    if (command === "init") {
        await handleInit();
        return;
    }
    if (command === "add") {
        await handleAdd();
        return;
    }
    if (command === "doctor") {
        await handleDoctor();
        return;
    }
    printHelp();
}
async function handleList() {
    const templateDir = resolveTemplateDir();
    const packs = await listPacks(templateDir);
    for (const pack of packs) {
        console.log(`${pack.id}\t${pack.displayName}`);
        console.log(`  ${pack.description}`);
        console.log(`  paths: ${pack.paths.join(", ")}`);
    }
}
async function handleInit() {
    const templateDir = resolveTemplateDir();
    const selection = await resolveSelection(templateDir, false);
    const options = resolveOptions();
    const { plans, warnings, errors } = await planSelection(rootDir, templateDir, selection, options.managedBlocks, options.force);
    reportPlanIssues(warnings, errors);
    if (errors.length > 0) {
        process.exit(2);
    }
    await applyPlan(rootDir, plans, options);
}
async function handleAdd() {
    const templateDir = resolveTemplateDir();
    const selection = await resolveSelection(templateDir, true);
    const options = resolveOptions();
    const { plans, warnings, errors } = await planSelection(rootDir, templateDir, selection, options.managedBlocks, options.force);
    reportPlanIssues(warnings, errors);
    if (errors.length > 0) {
        process.exit(2);
    }
    await applyPlan(rootDir, plans, options);
}
async function handleDoctor() {
    const templateDir = resolveTemplateDir();
    const selection = await resolveSelection(templateDir, true);
    const managedBlocks = process.argv.includes("--managed-blocks");
    const result = await runDoctor(rootDir, templateDir, selection, managedBlocks);
    for (const warning of result.warnings) {
        console.log(`WARN  ${warning}`);
    }
    for (const error of result.errors) {
        console.log(`ERROR ${error}`);
    }
    if (result.errors.length > 0) {
        process.exit(2);
    }
    if (result.warnings.length > 0) {
        process.exit(1);
    }
}
async function resolveSelection(templateDir, allowNeutralOnly) {
    const vendorsFlag = getFlagValue("--vendors");
    const allFlag = process.argv.includes("--all");
    const includeNeutral = !process.argv.includes("--no-neutral");
    const positionalVendor = getPositionalVendor();
    if (allFlag) {
        const { vendors } = await discoverPacks(templateDir);
        return { includeNeutral, vendors: vendors.map((vendor) => vendor.id) };
    }
    if (vendorsFlag || positionalVendor) {
        const vendorList = vendorsFlag ?? positionalVendor ?? "";
        return {
            includeNeutral,
            vendors: vendorList.split(",").map((entry) => entry.trim()).filter(Boolean),
        };
    }
    if (process.argv.includes("--interactive")) {
        const { vendors } = await discoverPacks(templateDir);
        const selected = await promptSelection(vendors.map((vendor) => vendor.id));
        return { includeNeutral, vendors: selected };
    }
    if (allowNeutralOnly) {
        return { includeNeutral, vendors: [] };
    }
    console.error("No vendors specified. Use --vendors, --all, or --interactive.");
    process.exit(2);
}
async function promptSelection(options) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
        rl.question(`Select vendors (${options.join(", ")}): `, (input) => resolve(input));
    });
    rl.close();
    return answer
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function resolveTemplateDir() {
    const override = getFlagValue("--template-dir");
    if (override) {
        return path.resolve(rootDir, override);
    }
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(currentDir, "../templates");
}
function resolveOptions() {
    return {
        force: process.argv.includes("--force"),
        managedBlocks: process.argv.includes("--managed-blocks"),
        dryRun: process.argv.includes("--dry-run"),
    };
}
function reportPlanIssues(warnings, errors) {
    for (const warning of warnings) {
        console.log(`WARN  ${warning}`);
    }
    for (const error of errors) {
        console.log(`ERROR ${error}`);
    }
}
function getFlagValue(flag) {
    const index = process.argv.indexOf(flag);
    if (index !== -1 && process.argv[index + 1]) {
        return process.argv[index + 1];
    }
    const withEquals = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    if (withEquals) {
        return withEquals.split("=")[1];
    }
    return undefined;
}
function getPositionalVendor() {
    if (command !== "add") {
        return undefined;
    }
    const candidate = process.argv[3];
    if (!candidate || candidate.startsWith("-")) {
        return undefined;
    }
    return candidate;
}
function printHelp() {
    console.log("AgentStack CLI");
    console.log("Usage: agentstack <command> [options]");
    console.log("Commands:");
    console.log("  list    List available packs");
    console.log("  init    Initialize a repo with neutral + vendor packs");
    console.log("  add     Add vendor packs to an existing repo");
    console.log("  doctor  Validate repo state for selected packs");
    console.log("Options:");
    console.log("  --vendors <list>          Comma-separated vendor ids");
    console.log("  --all                     Include all vendor packs");
    console.log("  --neutral / --no-neutral  Enable or disable neutral pack");
    console.log("  --template-dir <path>     Override template directory");
    console.log("  --force                   Overwrite existing files");
    console.log("  --managed-blocks          Enable managed Markdown blocks");
    console.log("  --dry-run                 Print plan without writing files");
    console.log("  --interactive             Prompt for vendor selection");
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
