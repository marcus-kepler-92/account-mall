import "dotenv/config"
import { execSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Ensure E2E product and 5 UNSOLD cards exist before any E2E test.
 * Runs SEED_E2E=1 so prisma/seed.ts creates/refills the e2e-product.
 */
async function globalSetup() {
    const cwd = path.resolve(__dirname, "..")
    execSync("npx tsx prisma/seed.ts", {
        cwd,
        env: { ...process.env, SEED_E2E: "1" },
        stdio: "inherit",
    })
}

export default globalSetup
