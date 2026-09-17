// Static-only extraction: does not import, eval, or execute downloaded website code.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
export function extractLabels(source) {
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  const bindings=new Map(), properties=[];
  const stack=[ast];
  while(stack.length){
    const node=stack.pop();
    if(!node || typeof node!=='object')continue;
    if(node.type==='AssignmentExpression' && node.operator==='=' && node.left.type==='Identifier')bindings.set(node.left.name,node.right);
    if(node.type==='VariableDeclarator' && node.id.type==='Identifier' && node.init)bindings.set(node.id.name,node.init);
    if(node.type==='Property' && !node.computed && node.kind==='init')properties.push(node);
    for(const value of Object.values(node))if(Array.isArray(value))stack.push(...value);else if(value && typeof value==='object')stack.push(value);
  }
  function literal(node,seen=new Set()){
    if(!node)return undefined;
    if(node.type==='Literal')return node.value;
    if(node.type==='TemplateLiteral' && node.expressions.length===0)return node.quasis[0].value.cooked;
    if(node.type==='Identifier'){
      if(seen.has(node.name))return undefined;
      return literal(bindings.get(node.name),new Set([...seen,node.name]));
    }
    if(node.type==='ArrayExpression')return node.elements.map(n=>literal(n,seen));
    if(node.type==='ObjectExpression'){
      const result={};
      for(const p of node.properties){
        if(p.type!=='Property'||p.computed||p.kind!=='init')return undefined;
        const key=p.key.name??p.key.value;
        if(key==='__proto__'||key==='constructor'||key==='prototype')return undefined;
        result[key]=literal(p.value,seen);
      }
      return result;
    }
    return undefined;
  }
  const result={};
  for(const p of properties){
    const key=p.key.name??p.key.value;
    if(typeof key!=='string' || !(/^(EDAyEb|0NW3sS|xfIykB|FT0eIf|PromptTextarea\.(stopGenerating|sendMessageTooltip)|voiceFloatingOrbSettingsModal\.intelligence\.option\.(instant|medium|high))$/.test(key)||/^chatgpt\.composer\.(intelligence_picker|model_picker)\./.test(key)))continue;
    const value=literal(p.value);
    const text=typeof value==='string'?value:Array.isArray(value)&&value.every(n=>n?.type===0&&typeof n.value==='string')?value.map(n=>n.value).join(''):null;
    if(text && text.length<=180)result[key]=text;
  }
  return result;
}
if(process.argv[1]?.endsWith('extract-official-labels.mjs')){
 const file=process.argv[2]; if(!file)throw new Error('Pass an exported official locale JS bundle');
 const source=fs.readFileSync(file,'utf8');
 const result={sha256:crypto.createHash('sha256').update(source).digest('hex'),labels:extractLabels(source)};
 if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}
