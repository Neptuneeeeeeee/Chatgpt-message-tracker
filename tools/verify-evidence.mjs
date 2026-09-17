// Revalidate committed aliases against original, complete official bundles without executing them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {extractLabels} from './extract-official-labels.mjs';
const directory=process.argv[2];
if(!directory)throw new Error('Pass the directory containing exported official locale bundles');
const root=path.resolve(import.meta.dirname,'..');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'docs/site-language-evidence.json'),'utf8'));
let bundles=0,strings=0;
for(const [locale,row] of Object.entries(evidence.locales)){
 if(locale==='en-US')continue;
 const file=path.join(directory,locale+'.js');const source=fs.readFileSync(file,'utf8');
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),row.sha256,locale+' source integrity');
 const actual=extractLabels(source);
 for(const [key,value] of Object.entries(row.messages)){assert.equal(actual[key],value,locale+'/'+key);strings++;}
 bundles++;console.log('verified',locale);
 // Release parser working memory between large bundles on a busy desktop.
 if(global.gc)global.gc();
}
console.log(JSON.stringify({nonEnglishOfficialBundlesVerified:bundles,originalStringsVerified:strings,remoteCodeExecuted:false,networkUsed:false}));
