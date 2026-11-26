import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const destination = process.argv[2];
if (!destination) throw new Error('Usage: node init-project.mjs <new-project-directory>');
const target = resolve(destination);
if (existsSync(target)) throw new Error('Destination already exists; choose a new directory.');
const template = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/remotion-template');
mkdirSync(dirname(target), {recursive: true});
cpSync(template, target, {recursive: true, errorOnExist: true, force: false});
console.log(`Created ${target}. Run npm ci there, then npm test and npm run smoke.`);
