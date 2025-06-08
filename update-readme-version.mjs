import { readFileSync, writeFileSync } from "fs";

// Read the current version from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = manifest.version;

// Read the README.md file
let readme = readFileSync("README.md", "utf8");

// Update the title with the version
// Match the pattern "# Sample Note Beta" and replace with "# Sample Note Beta (v0.1.26)"
readme = readme.replace(
	/^# Sample Note Beta.*$/m,
	`# Sample Note Beta (v${version})`
);

// Write the updated README back
writeFileSync("README.md", readme);

console.log(`Updated README.md with version v${version}`);
