import {DEFAULTS,LINES,COLORS} from './catalog.js';
import {validCorners} from './geometry.js';
const enums={model:['wall','tile','brick'],line:Object.keys(LINES),color:Object.keys(COLORS),finish:['Liso','Rasguñado','Rústico'],pattern:['half','threequarter','stack','soldier','herringbone'],shape:['rectangle','slope','custom'],cut:['trim','whole']};
const limits={width:[.3,6],height:[.3,4],openingWidth:[.1,4],openingHeight:[.1,3],offset:[0,.25]};
export function sanitizeConfig(input){
 const out=structuredClone(DEFAULTS);
 if(!input||typeof input!=='object')return out;
 for(const [k,options] of Object.entries(enums))if(options.includes(input[k]))out[k]=input[k];
 for(const [k,[lo,hi]] of Object.entries(limits))if(typeof input[k]==='number'&&Number.isFinite(input[k]))out[k]=Math.min(hi,Math.max(lo,input[k]));
 if([.008,.01,.012,.014].includes(input.joint))out.joint=input.joint;
 if(/^#[0-9a-f]{6}$/i.test(input.mortar))out.mortar=input.mortar;
 out.opening=input.opening===true;
 if(out.shape==='custom'){if(validCorners(input.corners))out.corners=input.corners.map(p=>p.map(n=>Math.round(n*10000)/10000));else out.shape='rectangle';}
 if(Array.isArray(input.brick)&&input.brick.length===3&&input.brick.every(n=>typeof n==='number'&&Number.isFinite(n)))out.brick=input.brick.map((n,i)=>Math.max(i===0?.1:.03,Math.min(i===0?.5:.25,n)));
 return out;
}
export function shareURL(base,state,brickType='solid'){
 const clean=sanitizeConfig(state),s=Object.fromEntries(Object.entries(clean).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(DEFAULTS[k])));
 const url=new URL(base);url.search='';url.hash='p='+encodeURIComponent(JSON.stringify({v:1,s,b:brickType==='grooved'?'grooved':'solid'}));return url.href;
}
export function readShare(hash){
 if(!hash.startsWith('#p='))return null;
 if(hash.length>6000)throw Error('El enlace compartido es demasiado largo.');
 const data=JSON.parse(decodeURIComponent(hash.slice(3)));
 if(data.v!==1)throw Error('Versión de enlace no compatible.');
 return {state:sanitizeConfig(data.s),brickType:data.b==='grooved'?'grooved':'solid'};
}
