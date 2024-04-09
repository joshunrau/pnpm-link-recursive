#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { hasProperty, isPathLikeString, isPlainObject, isStringRecord } from './utils.js';

const usage = ['Usage:', 'pnpm link <dir>', 'pnpm link --global <pkg>'].join('\n  ');

/**
 * The subset of package.json properties relevant for this script
 * @typedef {{
 *  name: string,
 *  dependencies?: { [key: string]: string }
 *  devDependencies?: { [key: string]: string }
 * }} PackageJson
 */

/**
 * @typedef {{ kind: 'local', dir: string, name: string } | { kind: 'global', name: string }} LinkTarget
 */

/**
 * Recursively walks through a directory tree and yields the absolute paths of all `package.json`
 * files, excluding those in `node_modules`.
 * @param {string} dir - the directory path to start walking from
 * @returns {AsyncGenerator<string>}
 */
async function* findPackages(dir) {
  for await (const dirent of await fs.opendir(dir)) {
    const entry = path.join(dir, dirent.name);
    if (dirent.isDirectory() && dirent.name !== 'node_modules') {
      yield* findPackages(entry);
    } else if (dirent.isFile() && dirent.name === 'package.json') {
      yield entry;
    }
  }
}

/**
 * Read and parse a package.json file
 * @param {string} filepath
 * @returns {Promise<PackageJson>}
 */
async function readPackageJson(filepath) {
  /** @type {PackageJson} */
  const packageJson = {};
  try {
    /** @type {unknown} */
    const content = JSON.parse(await fs.readFile(filepath, 'utf-8'));
    if (!isPlainObject(content)) {
      throw new Error(`Parsed content for file '${filepath}' is not a plain object: ${content}`);
    }
    if (!hasProperty(content, 'name')) {
      throw new Error(`Invalid format of file '${filepath}': missing required name property`);
    } else if (typeof content.name !== 'string') {
      throw new Error(`Invalid type of 'name' for file '${filepath}': must be string`);
    }
    packageJson.name = content.name;
    if (hasProperty(content, 'dependencies')) {
      if (!isStringRecord(content.dependencies)) {
        throw new Error(`Invalid type of 'dependencies' for file '${filepath}': must be string record`);
      }
      packageJson.dependencies = content.dependencies;
    }
    if (hasProperty(content, 'devDependencies')) {
      if (!isStringRecord(content.devDependencies)) {
        throw new Error(`Invalid type of 'devDependencies' for file '${filepath}': must be string record`);
      }
      packageJson.devDependencies = content.devDependencies;
    }
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to read package.json file: ${filepath}`, { cause: err });
  }
  return packageJson;
}

/**
 * Return whether the package specifies the dependency in either `dependencies` or `devDependencies`
 * @param {PackageJson} packageJson
 * @param {string} dependency
 */
function hasDependency(packageJson, dependency) {
  return (
    (packageJson.dependencies && packageJson.dependencies[dependency]) ||
    (packageJson.devDependencies && packageJson.devDependencies[dependency])
  );
}

async function main() {
  /** @type {LinkTarget} */
  let target;

  const args = process.argv.slice(2);
  if (args.length === 1 && isPathLikeString(args[0])) {
    const dir = path.resolve(process.cwd(), args[0]);
    if (!existsSync(dir)) {
      console.error(`Error: Target directory '${dir}' does not exist`);
      process.exit(1);
    } else if (!(await fs.lstat(dir)).isDirectory()) {
      console.error(`Error: Target '${dir}' is not a directory`);
      process.exit(1);
    }
    target = {
      dir,
      kind: 'local',
      name: await readPackageJson(path.resolve(dir, 'package.json')).then(({ name }) => name)
    };
  } else if (args.length === 2 && args[0] === '--global' && args[1]) {
    target = { kind: 'global', name: args[1] };
  } else {
    console.error(usage);
    process.exit(1);
  }

  for await (const filepath of findPackages(process.cwd())) {
    const packageJson = await readPackageJson(filepath);
    if (hasDependency(packageJson, target.name)) {
      const cmd = target.kind === 'local' ? `pnpm link ${target.dir}` : `pnpm link --global ${target.name}`;
      console.log(cmd);
      await spawn(cmd, {
        cwd: path.dirname(filepath),
        shell: true,
        stdio: 'inherit'
      });
    }
  }
}

await main();
