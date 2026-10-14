// Buildless, credential-free staging for static hosts. Existing routes stay intact.
// Usage: node tools/package-static.mjs /absolute/output/directory
import { mkdir, cp, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
const target = process.argv[2];
if (!target || !isAbsolute(target) || target === process.cwd()) throw new Error('Provide a separate absolute output directory.');
const output = resolve(target);
await mkdir(output, {recursive:true});
for (const name of ['css','js','data','vendor','docs','index.html','globe.html','test.html','README.md']) {
  await cp(name, resolve(output,name), {recursive:true});
}
await writeFile(resolve(output,'release.json'), JSON.stringify({
  sourceCommit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  entrypoint: 'globe.html',
}, null, 2)+'\n');
console.log('Staged static SkyLens assets at '+output);
