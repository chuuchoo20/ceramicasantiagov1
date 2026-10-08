import {mkdir,cp,copyFile,readdir,stat,rm} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {build} from 'esbuild';
const root=process.cwd(),dist=resolve(root,'dist');
if(dirname(dist)!==root||dist!==join(root,'dist'))throw Error('Ruta de build no válida.');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
// Explicit allowlist: never publish documentos, credentials, tests or development tools.
await copyFile(join(root,'index.html'),join(dist,'index.html'));
await cp(join(root,'src'),join(dist,'src'),{recursive:true,filter:p=>!p.includes('vendor')});
// RA con OpenCV: módulos cargados bajo demanda desde index.html.
await cp(join(root,'ra'),join(dist,'ra'),{recursive:true});
for(const dir of ['models','textures','environments','vendor']){const from=join(root,'assets',dir);try{await stat(from);}catch{continue;}await cp(from,join(dist,'assets',dir),{recursive:true,filter:p=>!p.endsWith('.gitkeep')&&!p.endsWith('.md')});}
await mkdir(join(dist,'src/vendor'),{recursive:true});
await build({stdin:{contents:"import QRCode from 'qrcode'; export default QRCode;",resolveDir:root},bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'eof',outfile:join(dist,'src/vendor/qrcode.js')});
await mkdir(join(root,'src/vendor'),{recursive:true});
await copyFile(join(dist,'src/vendor/qrcode.js'),join(root,'src/vendor/qrcode.js'));
async function files(dir){const result=[];for(const name of await readdir(dir)){const p=join(dir,name);if((await stat(p)).isDirectory())result.push(...await files(p));else result.push(p);}return result;}
const published=await files(dist);if(published.some(p=>/documentos|firebase-debug|\.firebaserc|\.php$|\.pdf$/i.test(p)))throw Error('La salida contiene archivos que no deben publicarse.');
console.log(`Build listo: ${published.length} archivos en dist. Solo aplicación y assets públicos.`);
