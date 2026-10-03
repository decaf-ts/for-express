/**
 * @module for-express/bin/cli
 * @summary Command line interface for the `@decaf-ts/for-express` package.
 * @description Implements the `for-express` binary (see the `bin` entry in
 * `package.json`) with three commands: `boot` spawns the application
 * entrypoint as a child process (auto-discovering conventional entry files
 * under `./lib` or `./src` when none is given), `version` prints the installed
 * package version, and `help` prints usage. Mirrors the CLI surface of the
 * other decaf integration packages.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Conventional application entrypoints tried, in order, when `boot` is called
 * without an explicit input; the first existing file relative to the current
 * working directory wins.
 * @const BOOT_INPUT_CANDIDATES
 * @type {string[]}
 * @category CLI
 */
const BOOT_INPUT_CANDIDATES = [
  "./lib/main.cjs",
  "./lib/main.js",
  "./src/main.ts",
  "./lib/app.cjs",
  "./lib/app.js",
  "./src/app.ts",
];

/**
 * @function resolveBootInput
 * @description Resolves the application entrypoint to boot: returns the
 * explicit input when provided, otherwise the first candidate from
 * {@link BOOT_INPUT_CANDIDATES} that exists relative to the current working
 * directory, falling back to `./lib/main`.
 * @summary Resolves the entrypoint for the `boot` command.
 * @param {string} [input] - Explicit entrypoint path supplied on the command line.
 * @return {string} The resolved entrypoint path.
 * @category CLI
 */
function resolveBootInput(input?: string): string {
  if (input) return input;
  const found = BOOT_INPUT_CANDIDATES.find((candidate) =>
    fs.existsSync(path.join(process.cwd(), candidate))
  );
  return found || "./lib/main";
}

/**
 * @function printHelp
 * @description Writes the CLI usage text (commands and defaults) to stdout.
 * @summary Prints the `for-express` usage help.
 * @return {void} Nothing; writes to stdout.
 * @category CLI
 */
function printHelp(): void {
  process.stdout.write(
    [
      "for-express - Express integration CLI for decaf-ts",
      "",
      "Usage:",
      "  for-express boot [entry]   Boot the application entrypoint (defaults to ./lib/main)",
      "  for-express version        Print the installed version",
      "  for-express help           Print this help",
      "",
    ].join("\n")
  );
}

/**
 * @function printVersion
 * @description Reads the package manifest next to the CLI bundle and writes
 * `name@version` to stdout; writes `unknown` when the manifest cannot be read
 * or parsed.
 * @summary Prints the installed package version.
 * @return {void} Nothing; writes to stdout.
 * @category CLI
 */
function printVersion(): void {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")
    );
    process.stdout.write(`${pkg.name}@${pkg.version}\n`);
  } catch {
    process.stdout.write("unknown\n");
  }
}

/**
 * @function boot
 * @description Spawns the resolved entrypoint in a child node process,
 * inheriting the current working directory, environment and stdio, and exits
 * the CLI with the child's exit code when it closes.
 * @summary Boots the application entrypoint as a child process.
 * @param {string} [input] - Optional explicit entrypoint; resolved via {@link resolveBootInput} when omitted.
 * @return {void} Nothing; the process exits with the child's exit code.
 * @category CLI
 */
function boot(input?: string): void {
  const entry = resolveBootInput(input);
  const child = spawn(process.execPath, [entry], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  child.on("close", (code) => process.exit(code ?? 0));
}

// CLI entrypoint: dispatch `boot [entry]`, `version` (`--version`/`-v`) and
// `help` (`--help`/`-h`, or no command); unknown commands print help to stderr
// and exit with status 1.
const [, , command, ...args] = process.argv;

switch (command) {
  case "boot":
    boot(args[0]);
    break;
  case "version":
  case "--version":
  case "-v":
    printVersion();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    process.stderr.write(`Unknown command: ${command}\n\n`);
    printHelp();
    process.exit(1);
}
