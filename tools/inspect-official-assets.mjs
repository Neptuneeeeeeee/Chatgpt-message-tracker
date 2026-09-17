// Inspect exported PUBLIC ChatGPT JS assets only. Never loads or executes a website bundle.
import fs from 'node:fs';
import path from 'node:path';
const directory = process.argv[2];
if (!directory || !fs.statSync(directory).isDirectory()) throw new Error('Pass a directory of exported public JS assets');
const wanted = /^(Instant|Medium|High|Extra High|Pro|Standard|Extended|Heavy|Light|.* thinking|Send prompt|Send message|Stop generating|Stop streaming|Thinking time)$/i;
const descriptors = [];
const localeReferences = [];
for (const name of (process.argv[3] ? [] : fs.readdirSync(directory).filter(name => name.endsWith('.js')))) {
  const text = fs.readFileSync(path.join(directory, name), 'utf8');
  for (const m of text.matchAll(/id:\s*[`"]([^`"]+)[`"],\s*defaultMessage:\s*[`"]([^`"]+)[`"]/g)) {
    if (wanted.test(m[2])) descriptors.push({file:name, id:m[1], text:m[2], context:text.slice(Math.max(0,m.index-120),m.index+m[0].length+100)});
  }
  for (const m of text.matchAll(/(?:zh-CN|zh-TW|zh-HK)[^\n]{0,120}import\([^)]{0,180}\)/g)) localeReferences.push({file:name, context:m[0]});
}
const result={descriptors,localeReferences};
fs.writeFileSync(path.join(directory,'descriptor-evidence.json'),JSON.stringify(result,null,2));
const unique = new Map(descriptors.map(item => [item.id, item]));
if (!process.argv[3]) console.log(JSON.stringify({descriptors:[...unique.values()].filter(item => item.file.startsWith('conversation-small')).map(({context,...item})=>item),localeReferences},null,2));
if (process.argv[3]) {
  const name = process.argv[3], term = process.argv[4];
  if (name !== path.basename(name) || !term) throw new Error('Pass an asset basename and exact term');
  const text = fs.readFileSync(path.join(directory,name),'utf8');
  let offset = 0;
  for (let count = 0; count < 6; count++) {
    const index = text.indexOf(term,offset); if (index < 0) break;
    console.log(text.slice(Math.max(0,index-1600),index+2400)); offset=index+term.length;
  }
}
