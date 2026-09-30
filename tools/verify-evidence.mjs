// Revalidate committed aliases against original, complete official bundles without executing them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {extractLabels} from './extract-official-labels.mjs';
const directory=process.argv[2];
if(!directory)throw new Error('Pass the directory containing exported official locale bundles');
// Optional: the directory of app-shell locale JSON files (update-app-shell-locales.mjs keeps them in its cache).
const shellDirectory=process.argv[3];
const root=path.resolve(import.meta.dirname,'..');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'docs/site-language-evidence.json'),'utf8'));
let bundles=0,strings=0,shellStrings=0;
for(const [locale,row] of Object.entries(evidence.locales)){
 if(locale==='en-US')continue;
 const file=path.join(directory,locale+'.js');const source=fs.readFileSync(file,'utf8');
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),row.sha256,locale+' source integrity');
 const actual=extractLabels(source);
 for(const [key,value] of Object.entries(row.messages)){assert.equal(actual[key],value,locale+'/'+key);strings++;}
 if(shellDirectory){
  const json=fs.readFileSync(path.join(shellDirectory,locale+'.json'),'utf8');
  assert.equal(crypto.createHash('sha256').update(json).digest('hex'),row.appShell.sha256,locale+' app-shell source integrity');
  const current=JSON.parse(json);
  for(const [key,value] of Object.entries(row.appShell.messages)){assert.equal(current[key],value,locale+'/'+key);shellStrings++;}
 }
 bundles++;console.log('verified',locale);
 // Release parser working memory between large bundles on a busy desktop.
 if(global.gc)global.gc();
}
console.log(JSON.stringify({nonEnglishOfficialBundlesVerified:bundles,originalStringsVerified:strings,appShellStringsVerified:shellDirectory?shellStrings:'not checked',remoteCodeExecuted:false,networkUsed:false}));
