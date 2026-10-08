// Pure geometry, shared by the photo compositor, Three.js and exports. Metres throughout.
export const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
export function clip(poly,boundary){
 let out=poly;
 for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];const side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);const input=out;out=[];if(!input.length)break;
 for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q);if(sp>=-1e-9)out.push(p);if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}
 }return out;
}
export const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
// Clockwise screen-space corners: top-left, top-right, bottom-right, bottom-left.
// Stored in the model, independent of camera/photo perspective; exported to AR.
export function wallCorners(s){
 if(s.shape==='custom'&&validCorners(s.corners))return s.corners.map(p=>[...p]);
 return s.shape==='slope'?[[0,0],[1,.35],[1,1],[0,1]]:[[0,0],[1,0],[1,1],[0,1]];
}
export function boundary(s){return wallCorners(s).map(([u,v])=>[u*s.width,(1-v)*s.height]).reverse();}
export function opening(s){const w=Math.min(s.openingWidth,s.width*.8),h=Math.min(s.openingHeight,s.height*.55);return {x:(s.width-w)/2,y:(s.height-h)/2,w,h};}
export function regions(s){if(!s.opening)return [boundary(s)];const o=opening(s);return [rect(0,0,s.width,o.y),rect(0,o.y+o.h,s.width,s.height-o.y-o.h),rect(0,o.y,o.x,o.h),rect(o.x+o.w,o.y,s.width-o.x-o.w,o.h)].map(p=>clip(p,boundary(s)));}
export function buildLayout(s,size){
 const [w,h]=size,g=s.joint,b=boundary(s),regionsList=regions(s),pieces=[];let id=0;
 function add(p,cx,cy,pw,ph,angle){const originalArea=pw*ph,inside=clip(p,b);if(inside.length<3||area(inside)<1e-8)return;
 const fragments=s.opening?regionsList.map(r=>clip(p,r)).filter(p=>p.length>2&&area(p)>1e-8):[inside];const sum=fragments.reduce((n,p)=>n+area(p),0);if(!sum)return;const full=Math.abs(sum-originalArea)<1e-8;if(s.cut==='whole'&&!full)return;
 pieces.push({id:id++,polys:fragments,full,cx,cy,w:pw,h:ph,angle});if(pieces.length>12000)throw Error('Reduce las dimensiones del muro.');}
 if(s.pattern==='herringbone'){
 // Two orthogonal rectangles tile a lattice with basis (L,L), (H,-H).
 // Rotate that exact tiling 45°. Shrinking each tile by the joint gives constant gaps.
 const L=w+g,H=h+g,R=Math.hypot(s.width,s.height)+L*3,rt=Math.SQRT1_2;
 for(let i=-Math.ceil(R/L);i<=Math.ceil(R/L);i++)for(let j=-Math.ceil(R/H);j<=Math.ceil(R/H);j++){
 const x=i*L+j*H,y=i*L-j*H;
 for(const [tx,ty,pw,ph] of [[x+g/2,y+g/2,w,h],[x+L+g/2,y+g/2,h,w]]){const p=rect(tx,ty,pw,ph).map(([a,b])=>[(a-b)*rt+s.width/2+s.offset,(a+b)*rt+s.height/2]);const cx=p.reduce((v,a)=>v+a[0],0)/4,cy=p.reduce((v,a)=>v+a[1],0)/4;add(p,cx,cy,pw,ph,Math.PI/4);}
 }
 }else{const pw=s.pattern==='soldier'?h:w,ph=s.pattern==='soldier'?w:h;for(let row=0,y=0;y<s.height;row++,y+=ph+g){const shift=(row%2)*(s.pattern==='half'?.5:s.pattern==='threequarter'?.75:0)*(pw+g)+s.offset;for(let x=-pw-g+shift%(pw+g);x<s.width;x+=pw+g)add(rect(x,y,pw,ph),x+pw/2,y+ph/2,pw,ph,0);}}
 return {pieces,regions:regionsList,area:regionsList.reduce((n,p)=>n+area(p),0),cuts:pieces.filter(p=>!p.full).length};
}
// Homography maps a unit square to a convex quadrilateral, preserving straight lines.
export function homography(q){const [a,b,c,d]=q,dx1=b[0]-c[0],dx2=d[0]-c[0],dx3=a[0]-b[0]+c[0]-d[0],dy1=b[1]-c[1],dy2=d[1]-c[1],dy3=a[1]-b[1]+c[1]-d[1],den=dx1*dy2-dx2*dy1;const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;return (u,v)=>{const z=g*u+h*v+1;return [((b[0]-a[0]+g*b[0])*u+(d[0]-a[0]+h*d[0])*v+a[0])/z,((b[1]-a[1]+g*b[1])*u+(d[1]-a[1]+h*d[1])*v+a[1])/z];};}
export function validQuad(q){return Array.isArray(q)&&q.length===4&&q.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&area(q)>.015&&q.every((a,i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>.003;});}
export function validCorners(q){return validQuad(q)&&q.every(p=>p.every(n=>n>=0&&n<=1));}
export function unprojectQuad(q,x,y){
 const [a,b,c,d]=q,dx1=b[0]-c[0],dx2=d[0]-c[0],dx3=a[0]-b[0]+c[0]-d[0],dy1=b[1]-c[1],dy2=d[1]-c[1],dy3=a[1]-b[1]+c[1]-d[1],den=dx1*dy2-dx2*dy1;
 const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
 const A=b[0]-a[0]+g*b[0]-x*g,B=d[0]-a[0]+h*d[0]-x*h,C=b[1]-a[1]+g*b[1]-y*g,D=d[1]-a[1]+h*d[1]-y*h,det=A*D-B*C;
 return [((x-a[0])*D-B*(y-a[1]))/det,(A*(y-a[1])-(x-a[0])*C)/det];
}
