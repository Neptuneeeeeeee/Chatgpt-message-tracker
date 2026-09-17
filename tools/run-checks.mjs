// Run release checks with persistent stdout/stderr and a machine-readable exit receipt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.argv[2]||'/tmp/cmt-checks');
fs.mkdirSync(out,{recursive:true});
const runtime=['manifest.json',...fs.readdirSync(path.join(root,'src')).filter(n=>/\.(js|html|css)$/.test(n)).map(n=>'src/'+n)];
function hashes(){return Object.fromEntries(runtime.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));}
const startHashes=hashes();
const report={version:JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version,startedAt:new Date().toISOString(),pass:false,checks:[]};
try {
  const tests=fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).sort().map(n=>'tests/'+n);
  for(const [name,args] of [['static',['tools/check-extension.mjs']],['unit',['--test','--test-concurrency=1','--test-reporter=spec',...tests]]]){
    console.log('RUN',name);
    const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024,env:{...process.env,NO_COLOR:'1',NODE_DISABLE_COLORS:'1',FORCE_COLOR:'0'}});
    fs.writeFileSync(path.join(out,name+'-stdout.log'),r.stdout||'');
    fs.writeFileSync(path.join(out,name+'-stderr.log'),r.stderr||'');
    report.checks.push({name,exitCode:r.status,signal:r.signal,error:r.error?.message||null});
    if(r.status!==0)throw new Error(name+' failed: '+(r.error?.message||r.stderr||r.stdout?.slice(-5000)));
    if(name==='static')report.static=JSON.parse(r.stdout);
    else {
      const clean=r.stdout.replace(/\x1b\[[0-9;]*m/g,'');
      report.unit=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>{
        const m=clean.match(new RegExp('(?:^|\\n)[^\\n]*?\\b'+key+' (\\d+)(?:\\r?\\n|$)'));
        if(!m)throw new Error('Missing test summary field: '+key);
        return [key,Number(m[1])];
      }));
      if(report.unit.fail||report.unit.cancelled||report.unit.skipped||report.unit.todo)throw new Error('Incomplete tests');
      console.log(JSON.stringify(report.unit));
    }
  }
  report.sourceSHA256=hashes();
  if(JSON.stringify(report.sourceSHA256)!==JSON.stringify(startHashes))throw new Error('Runtime changed during checks');
  report.pass=true;
} catch(error) { report.error=String(error.stack||error);process.exitCode=1; }
report.finishedAt=new Date().toISOString();
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version:report.version,pass:report.pass,unit:report.unit,checks:report.checks,error:report.error},null,2));
