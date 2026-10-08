import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Brush,Evaluator,INTERSECTION} from 'three-bvh-csg';
import {clip,area} from '../src/geometry.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const module=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
writeFileSync(new URL('../tmp/single-file-syntax.mjs',import.meta.url),module);
const source=module.slice(module.indexOf('const CONFIG='),module.indexOf('restore();'));
const unitBox=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();
const ctx={THREE,mergeGeometries,Brush,Evaluator,INTERSECTION,unitBox,structuredClone,document:{getElementById(){return {textContent:''};}},localStorage:{setItem(){}}};
vm.createContext(ctx);vm.runInContext(source+';globalThis.api={CONFIG,APP_STATE,buildLayout,createCutWall,estimateUnits,wallPolygon,polygonBounds,validPolygon,prepareGeometryAttributes,createExportSnapshot,validateGLB,pieceGeometry};',ctx);
const {CONFIG,APP_STATE,buildLayout,createCutWall,estimateUnits,wallPolygon,polygonBounds,validPolygon,prepareGeometryAttributes,createExportSnapshot,validateGLB,pieceGeometry}=ctx.api;
const near=(a,b,eps=2e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('Single file imports real CSG via CDN; exact catalogue',()=>{
  assert.ok(!/<(?:script|link)[^>]+(?:src|href)="\.\//.test(html));
  assert.ok(html.includes('three-bvh-csg@0.0.17/src/index.js'));
  assert.deepEqual(Object.keys(CONFIG.colors),['Arcilla','Chocolate','Envejecido','Gris Urbano','Marfil','Natural','Siena']);
  assert.deepEqual({...CONFIG.formats.nacional},{x:.24,y:.055,z:.013});
  assert.deepEqual({...CONFIG.formats.importado},{x:.24,y:.06,z:.013});
  assert.deepEqual([...CONFIG.joints],[.008,.010,.012,.014]);
});
test('Budget: ceil(area/module) then 5% waste rounded up',()=>{
  const result=estimateUnits(APP_STATE,CONFIG.formats.nacional);
  assert.equal(result.base,237);assert.equal(result.waste,12);assert.equal(result.total,249);
  for(const pattern of Object.keys(CONFIG.patterns))assert.equal(estimateUnits({...APP_STATE,pattern},CONFIG.formats.nacional).total,249);
});
test('Reject bow-ties; support concave quadrilaterals',()=>{
  assert.equal(validPolygon([[0,0],[1,1],[1,0],[0,1]]),false);
  assert.equal(validPolygon([[0,0],[1,0],[.35,.35],[0,1]]),true);
});
test('Masonry starts at Point 4 with a full first brick, including a moved datum',()=>{
  for(const format of Object.keys(CONFIG.formats))for(const pattern of ['half','threequarter','stack','soldier'])for(const polygon of [[[0,0],[1,0],[1,1],[0,1]],[[.2,.1],[.9,.23],[.9,.9],[.2,.9]],[[.1,0],[1,.2],[.9,1],[.2,.85]]]){
    const state={...APP_STATE,format,pattern,polygon},d=CONFIG.formats[format],p4=wallPolygon(state)[3],w=pattern==='soldier'?d.y:d.x,h=pattern==='soldier'?d.x:d.y;
    const first=buildLayout(state,d).find(p=>Math.abs(p.x-p4[0]-w/2)<1e-9&&Math.abs(p.y-p4[1]-h/2)<1e-9);
    assert.ok(first,'First piece centre is datum plus half-size');
    const b=polygonBounds(first.footprint);near(b.minX,p4[0],1e-9);near(b.minY,p4[1],1e-9);near(b.maxX-b.minX,w,1e-9);near(b.maxY-b.minY,h,1e-9);
  }
});
test('Herringbone first rotated footprint is also anchored at Point 4',()=>{
  const state={...APP_STATE,pattern:'herringbone',polygon:[[.2,.1],[.9,.23],[.9,.9],[.2,.9]]},d=CONFIG.formats.nacional,p4=wallPolygon(state)[3];
  assert.ok(buildLayout(state,d).some(p=>{const b=polygonBounds(p.footprint);return Math.abs(b.minX-p4[0])<1e-9&&Math.abs(b.minY-p4[1])<1e-9;}));
});
test('Export preflight repairs invalid normals and missing UVs without changing positions',()=>{
  const geometry=new THREE.BoxGeometry(.24,.055,.013).toNonIndexed(),positions=geometry.attributes.position.array.slice();
  geometry.attributes.normal.array.fill(NaN);geometry.deleteAttribute('uv');prepareGeometryAttributes(geometry);
  assert.deepEqual(geometry.attributes.position.array,positions);
  assert.equal(geometry.attributes.uv.count,geometry.attributes.position.count);
  assert.ok(geometry.attributes.uv.array.every(Number.isFinite));
  const normals=geometry.attributes.normal;for(let i=0;i<normals.count;i++)near(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i)),1);
  geometry.attributes.position.array[0]=NaN;assert.throws(()=>prepareGeometryAttributes(geometry),/posiciones/);geometry.dispose();
});
test('Detached export snapshot is visible, has a standard material and world transform',()=>{
  const source=new THREE.Mesh(new THREE.BoxGeometry(.24,.055,.013),new THREE.MeshBasicMaterial()),parent=new THREE.Group();parent.position.set(1,2,3);source.position.set(.5,0,0);source.visible=false;parent.add(source);
  const snapshot=createExportSnapshot(source);assert.ok(snapshot.material.isMeshStandardMaterial);assert.ok(snapshot.visible);assert.equal(snapshot.children.length,0);assert.equal(snapshot.parent,null);near(snapshot.matrixWorld.elements[12],1.5);assert.notEqual(source.geometry,snapshot.geometry);assert.equal(source.visible,false);
  snapshot.geometry.dispose();snapshot.material.dispose();source.geometry.dispose();source.material.dispose();
  assert.throws(()=>validateGLB(null),/GLB binario/);
});
function measure(geometry){
  const pos=geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();let surface=0,front=0,volume=0;
  for(let i=0;i<pos.count;i+=3){a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);n.crossVectors(b.clone().sub(a),c.clone().sub(a));surface+=n.length()/2;volume+=a.dot(new THREE.Vector3().crossVectors(b,c))/6;if(n.z>0&&Math.abs(n.x)+Math.abs(n.y)<1e-8)front+=n.z/2;}
  return {surface,front,volume};
}
for(const pattern of Object.keys(CONFIG.patterns))for(const format of Object.keys(CONFIG.formats))test(`${pattern}/${format}: CSG volume, complete front coverage and closed cut faces`,()=>{
  for(const joint of CONFIG.joints)for(const polygon of [[[0,0],[1,0],[1,1],[0,1]],[[.02,.05],[1,.31],[.88,.97],[.09,.86]]]){
    const s={...APP_STATE,width:.87,height:.63,joint,pattern,format,polygon},d=CONFIG.formats[format],original=JSON.stringify(polygon);
    const poly=wallPolygon(s).reverse(),candidates=buildLayout(s,d),{mesh}=createCutWall(s,d,material);
    assert.ok(mesh.isMesh&&!mesh.isInstancedMesh);assert.ok(mesh.geometry.attributes.position.count>0);
    let expectedArea=0,expectedSide=0;
    for(const piece of candidates){const cut=clip(piece.footprint,poly),cutArea=area(cut);expectedArea+=cutArea;if(cutArea>1e-10)expectedSide+=cut.reduce((sum,p,i)=>sum+Math.hypot(p[0]-cut[(i+1)%cut.length][0],p[1]-cut[(i+1)%cut.length][1]),0)*d.z;}
    const actual=measure(mesh.geometry);
    near(actual.front,expectedArea);near(actual.volume,expectedArea*d.z);near(actual.surface,2*expectedArea+expectedSide,6e-6);
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok(z>=-2e-6&&z<=d.z+2e-6);
      for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length];assert.ok((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])>=-2e-6,'No vertex outside cut');}
    }
    const baseBounds=polygonBounds(candidates.flatMap(p=>p.footprint)),bounds=polygonBounds(poly),margin=2*(d.x+joint);
    assert.ok(baseBounds.minX<bounds.minX-margin&&baseBounds.maxX>bounds.maxX+margin&&baseBounds.minY<bounds.minY-margin&&baseBounds.maxY>bounds.maxY+margin,'Two extra brick pitches on each side');
    assert.equal(JSON.stringify(polygon),original);mesh.geometry.dispose();
  }
});
test('Concave CSG matches independently triangulated 2D clipping',()=>{
  const s={...APP_STATE,width:.9,height:.7,pattern:'herringbone',polygon:[[0,0],[1,0],[.35,.35],[0,1]]},d=CONFIG.formats.nacional;
  const poly=wallPolygon(s).reverse(),v=poly.map(p=>new THREE.Vector2(...p)),triangles=THREE.ShapeUtils.triangulateShape(v,[]).map(t=>t.map(i=>poly[i]));
  let expected=0;for(const piece of buildLayout(s,d))for(const triangle of triangles)expected+=area(clip(piece.footprint,triangle));
  const {mesh}=createCutWall(s,d,material),actual=measure(mesh.geometry);near(actual.front,expected);near(actual.volume,expected*d.z);mesh.geometry.dispose();
});
test('Maximum 6 x 4 m remains within capacity and produces a cut mesh',()=>{
  const s={...APP_STATE,width:6,height:4,pattern:'herringbone'};
  assert.ok(buildLayout(s,CONFIG.formats.nacional).length<CONFIG.maxPieces);
  const {mesh}=createCutWall(s,CONFIG.formats.nacional,material);assert.ok(mesh.geometry.attributes.position.count>0);mesh.geometry.dispose();
});
test('Texturas reales: UV en metros por cara y registro completo',()=>{
  const d={x:.29,y:.071,z:.14},g=pieceGeometry(d,3),uv=g.attributes.uv,n=g.attributes.normal;
  const span=(axis,sign)=>{const us=[],vs=[];for(let i=0;i<uv.count;i++)if(Math.sign(n.getComponent(i,axis))===sign&&Math.abs(n.getComponent(i,axis))>.5){us.push(uv.getX(i));vs.push(uv.getY(i));}return [Math.max(...us)-Math.min(...us),Math.max(...vs)-Math.min(...vs)];};
  const [fu,fv]=span(2,1);near(fu,d.x);near(fv,d.y);   // frente: largo × alto
  const [tu,tv]=span(1,1);near(tu,d.x);near(tv,d.z);   // canto: largo × espesor
  const [su,sv]=span(0,1);near(su,d.z);near(sv,d.y);   // cabeza: espesor × alto
  assert.notDeepEqual([...pieceGeometry(d,4).attributes.uv.array],[...uv.array],'cada pieza toma otro recorte de la foto');
  for(const [name,t] of Object.entries(CONFIG.textures)){
    assert.ok(Object.hasOwn(CONFIG.finishes,name.split('/')[0]),name);
    assert.match(t.dir,/^[a-z0-9-]+$/);assert.ok(t.sizeM>0.02&&t.sizeM<1);assert.match(t.mean,/^#[0-9a-f]{6}$/);assert.ok(Object.hasOwn(CONFIG.colors,t.base));
    for(const f of ['color.jpg','normal.jpg','thumb.jpg'])assert.ok(existsSync(new URL(`../assets/textures/${t.dir}/${f}`,import.meta.url)),`${t.dir}/${f}`);
  }
});
