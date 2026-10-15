/* VOYASCOPE — independently constructed, unofficial shape studies.
 * three.js r128 core only. No external assets. +Y up; neutral bounds = 2.
 * makeKit once per renderer/application; caller owns its materials/textures.
 */
const PI = Math.PI, TAU = PI * 2;
const NASA = 'https://science.nasa.gov/';
const REF = {
  jwst: [NASA+'mission/webb/', NASA+'3d-resources/james-webb-space-telescope-a/'],
  parker: [NASA+'mission/parker-solar-probe/', NASA+'resource/parker-solar-probe-3d-model/'],
  bepi: ['https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/Latest_updates_BepiColombo_s_arrival_at_Mercury','https://www.esa.int/ESA_Multimedia/Images/2018/10/BepiColombo_arrival_at_Mercury_timeline','https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/BepiColombo_factsheet','https://mio.isas.jaxa.jp/mission/'],
  rover: [NASA+'mission/mars-2020-perseverance/',NASA+'3d-resources/mars-2020-perseverance-rover/'],
  mmx: ['https://www.mmx.jaxa.jp/','https://www.mmx.jaxa.jp/gallery/','https://fanfun.jaxa.jp/countdown/mmx_h3f10/files/mmx_press-kit_ja_20260918.pdf','https://mmx-news.isas.jaxa.jp/?p=1998'],
  haya: ['https://www.isas.jaxa.jp/missions/spacecraft/current/hayabusa2','https://www.hayabusa2.jaxa.jp/'],
  juno: [NASA+'mission/juno/',NASA+'resource/juno-3d-model/'],
  nh: [NASA+'mission/new-horizons/',NASA+'resource/new-horizons-3d-model/'],
  voyager: [NASA+'mission/voyager/voyager-1/',NASA+'resource/voyager-3d-model/']
};

export function makeKit(T) {
  let seed=319;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  function texture(draw, color=false) {
    const c=document.createElement('canvas'); c.width=c.height=128;
    draw(c.getContext('2d'));
    const t=new T.CanvasTexture(c); t.wrapS=t.wrapT=T.RepeatWrapping;
    if(color)t.encoding=T.sRGBEncoding;
    return t;
  }
  const foil=texture(c=>{
    c.fillStyle='#888';c.fillRect(0,0,128,128);
    for(let i=0;i<650;i++){
      const x=random()*128,y=random()*128,v=45+random()*170;
      c.strokeStyle=`rgb(${v},${v},${v})`;c.lineWidth=.35+random()*.65;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+(random()-.5)*22,y+(random()-.5)*22);c.stroke();
    }
  });
  const cells=texture(c=>{
    c.fillStyle='#10284d';c.fillRect(0,0,128,128);
    for(let x=0;x<128;x+=16){
      c.fillStyle=x%32?'#142d50':'#102443';c.fillRect(x+1,1,14,126);
      c.fillStyle='#617e9d';c.fillRect(x,0,.6,128);
      c.fillStyle='#a5a7a0';c.fillRect(x+7,0,.5,128);
    }
    c.fillStyle='#395472'; for(let y=0;y<128;y+=16)c.fillRect(0,y,128,.6);
  },true);
  // 薄膜の太陽電池（紫がかった灰色に、銀の細い格子）
  const cellsThin=texture(c=>{
    c.fillStyle='#2b2a3a';c.fillRect(0,0,128,128);
    for(let x=0;x<128;x+=8)for(let y=0;y<128;y+=16){c.fillStyle=(x+y)%32?'#353248':'#2f2d40';c.fillRect(x+.6,y+.6,7,15);}
    c.fillStyle='#8f93a3';for(let y=0;y<128;y+=16)c.fillRect(0,y,128,.7);
    c.fillStyle='#6d7080';for(let x=0;x<128;x+=32)c.fillRect(x,0,.6,128);
  },true);
  // A tiny procedural reflection field, not an image asset or another light.
  const faces=Array.from({length:6},(_,i)=>{
    const c=document.createElement('canvas');c.width=c.height=64;
    const g=c.getContext('2d'),a=g.createLinearGradient(0,0,64,64);
    a.addColorStop(0,i===2?'#e4dfd3':'#73716b');a.addColorStop(.42,'#a6a098');
    a.addColorStop(.5,'#eee7d9');a.addColorStop(.58,'#85827b');a.addColorStop(1,'#464540');
    g.fillStyle=a;g.fillRect(0,0,64,64);return c;
  });
  const env=new T.CubeTexture(faces);env.encoding=T.sRGBEncoding;env.needsUpdate=true;
  const mat=(name,color,metalness,roughness,extra={})=>{
    const m=new T.MeshStandardMaterial({color,metalness,roughness,envMap:env,envMapIntensity:.45,...extra});m.color.convertSRGBToLinear();m.name=name;return m;
  };
  return {
    gold:mat('foil-gold',0xbd882c,.78,.4,{bumpMap:foil,bumpScale:.006}),
    silver:mat('silver',0xb5c1c6,.8,.34),
    white:mat('ceramic-white',0xd7dedb,.18,.54),
    black:mat('carbon-black',0x10141c,.3,.65),
    navy:mat('deep-navy',0x143057,.42,.45),
    solar:mat('solar-cells',0xffffff,.62,.3,{map:cells}),
    mirror:mat('gold-mirror',0xe7b94f,1,.12,{envMapIntensity:1.25}),
    foilSilver:mat('foil-silver',0xc9d0d4,.85,.3,{bumpMap:foil,bumpScale:.006}),
    copper:mat('copper',0xc4682f,.6,.42),
    solarThin:mat('solar-thin-film',0xffffff,.5,.38,{map:cellsThin}),
    graphite:mat('graphite',0x2c313b,.4,.55),
    olive:mat('radiator-olive',0x56695f,.35,.5),
    goldMLI:mat('foil-gold-bright',0xe0b03e,.85,.26,{bumpMap:foil,bumpScale:.014,envMapIntensity:.8}),
    textures:{foil,cells,cellsThin,env}
  };
}

// Per-model geometry cache and per-parent instance batches. No geometry crosses
// model ownership boundaries; independent parts remain actual THREE.Groups.
function builder(T,K) {
  const root=new T.Group(),content=new T.Group();root.add(content);
  const geometries=new Map(),batches=new Map(),dummy=new T.Object3D();
  const v=new T.Vector3(),a=new T.Vector3(),up=new T.Vector3(0,1,0);
  function geo(key,fn){if(!geometries.has(key))geometries.set(key,fn());return geometries.get(key);}
  const box=()=>geo('box',()=>new T.BoxGeometry(1,1,1));
  const cyl=(n=24,top=1)=>geo('c'+n+':'+top,()=>new T.CylinderGeometry(top,1,1,n,1,false));
  function put(g,m,p=[0,0,0],s=[1,1,1],r=[0,0,0],parent=content){
    dummy.position.set(...p);dummy.scale.set(...s);dummy.rotation.set(...r);dummy.updateMatrix();
    let by=batches.get(parent);if(!by){by=new Map();batches.set(parent,by);}
    const key=g.uuid+':'+m;let b=by.get(key);
    if(!b){b={g,mat:K[m],matrices:[]};by.set(key,b);}b.matrices.push(dummy.matrix.clone());
  }
  function group(name,p=[0,0,0],r=[0,0,0],parent=content){const g=new T.Group();g.name=name;g.position.set(...p);g.rotation.set(...r);parent.add(g);return g;}
  function B(m,p,s,r=[0,0,0],par=content){put(box(),m,p,s,r,par);}
  function C(m,p,radius,height,r=[0,0,0],par=content,n=24,top=1){put(cyl(n,top),m,p,[radius,height,radius],r,par);}
  function rod(m,start,end,r=.02,par=content,n=8){
    a.set(...start);v.set(...end).sub(a);const len=v.length();
    dummy.quaternion.setFromUnitVectors(up,v.normalize());const e=new T.Euler().setFromQuaternion(dummy.quaternion);
    C(m,[(start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2],r,len,[e.x,e.y,e.z],par,n);
  }
  function ring(m,p,r,t=.015,rot=[0,0,0],par=content){
    put(geo('torus',()=>new T.TorusGeometry(1,.025,6,40)),m,p,[r,r,t/.025],rot,par);
  }
  function ball(m,p,s,par=content){put(geo('sphere',()=>new T.SphereGeometry(1,16,10)),m,p,s,[0,0,0],par);}
  function panel(w,h,p,rot=[0,0,0],par=content,nx=8,ny=6,cell='solar',back='black'){
    const g=group('solar-array',p,rot,par);
    B('silver',[0,0,0],[w+.06,.045,h+.06],[0,0,0],g);
    B(back,[0,-.03,0],[w,.035,h],[0,0,0],g);
    // Distinct cell tiles, instanced in a single draw per panel.
    for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)
      B(cell,[(x+.5-nx/2)*w/nx,.03,(y+.5-ny/2)*h/ny],[w/nx*.955,.008,h/ny*.96],[0,0,0],g);
    for(const x of [-w/2,w/2])B('silver',[x,.045,0],[.018,.018,h],[0,0,0],g);
    for(const z of [-h/2,h/2])B('silver',[0,.045,z],[w,.018,.018],[0,0,0],g);
    return g;
  }
  function dish(radius,p,rot=[0,0,0],par=content,material='white'){
    const g=group('high-gain-antenna',p,rot,par);
    const d=geo('dish',()=>{
      const pts=[];for(let i=0;i<=12;i++){let x=i/12;pts.push(new T.Vector2(Math.max(.001,x),.28*x*x));}
      for(let i=12;i>=0;i--){let x=i/12;pts.push(new T.Vector2(Math.max(.001,x),.28*x*x-.025));}
      return new T.LatheGeometry(pts,48);
    });
    put(d,material,[0,0,0],[radius,radius,radius],[0,0,0],g);
    ring('silver',[0,.28*radius,0],radius,.013*radius,[PI/2,0,0],g);
    for(let i=0;i<3;i++){const t=i*TAU/3;rod('silver',[Math.cos(t)*radius*.86,radius*.21,Math.sin(t)*radius*.86],[0,radius*.72,0],radius*.012,g);}
    C('gold',[0,radius*.72,0],radius*.09,radius*.12,[0,0,0],g);
    C('silver',[0,-radius*.1,0],radius*.22,radius*.18,[0,0,0],g);
    return g;
  }
  function rtg(p,rot,par=content,scale=1){
    const g=group('RTG',p,rot,par),s=scale;
    C('black',[0,0,0],.2*s,.8*s,[0,0,0],g,32);
    for(const y of [-.39,-.28,.28,.39])C('silver',[0,y*s,0],.208*s,.028*s,[0,0,0],g,32);
    for(let i=0;i<8;i++){let t=i*PI/4;B('black',[Math.cos(t)*.24*s,0,Math.sin(t)*.24*s],[.2*s,.75*s,.018*s],[0,-t,0],g);}
    C('silver',[0,.44*s,0],.08*s,.12*s,[0,0,0],g);
    return g;
  }
  function bolts(p,w,h,par=content,rot=[0,0,0]){
    const g=group('fasteners',p,rot,par);
    for(let x of [-w/2,0,w/2])for(let z of [-h/2,h/2])C('silver',[x,0,z],.018,.016,[0,0,0],g,8);
  }
  function truss(start,end,width=.15,par=content){
    const g=group('truss',start,[0,0,0],par),delta=new T.Vector3(...end).sub(new T.Vector3(...start)),len=delta.length();
    g.quaternion.setFromUnitVectors(up,delta.normalize());
    const corners=[[-width,0,-width],[width,0,-width],[0,0,width]];
    for(let i=0;i<3;i++)rod('silver',corners[i],[corners[i][0],len,corners[i][2]],width*.08,g);
    const n=Math.ceil(len/(width*3));
    for(let j=0;j<n;j++)for(let i=0;i<3;i++){
      let c=corners[i],d=corners[(i+1)%3];
      rod('silver',[c[0],j*len/n,c[2]],[d[0],(j+1)*len/n,d[2]],width*.045,g,6);
    }
    return g;
  }
  function finish(refs,guessed,pose,extra={}){
    let triangles=0,meshes=0,instances=0;
    for(const [parent,by] of batches)for(const b of by.values()){
      const mesh=new T.InstancedMesh(b.g,b.mat,b.matrices.length);mesh.frustumCulled=false;
      b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);
      triangles+=(b.g.index?b.g.index.count:b.g.attributes.position.count)/3*b.matrices.length;meshes++;instances+=b.matrices.length;
    }
    // r128 Box3.setFromObject ignores instance transforms: compute exact bounds.
    content.updateMatrixWorld(true);const bounds=new T.Box3(),m=new T.Matrix4();
    for(const [parent,by] of batches)for(const b of by.values())for(const local of b.matrices){
      m.multiplyMatrices(parent.matrixWorld,local);const pos=b.g.attributes.position;
      for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);bounds.expandByPoint(v);}
    }
    const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),scale=2/Math.max(size.x,size.y,size.z);
    content.scale.setScalar(scale);content.position.copy(center).multiplyScalar(-scale);
    root.name='VOYASCOPE shape study';
    root.userData={pose,refs:[...refs],guessed,triangles,meshes,instances,normalizedSize:size.multiplyScalar(scale).toArray(),...extra};
    root.updateMatrixWorld(true);return root;
  }
  return {T,K,root,content,geo,put,B,C,rod,ring,ball,group,panel,dish,rtg,bolts,truss,finish};
}

function jwst(T,K){
  const b=builder(T,K),{B,C,rod,group,put,geo,panel}=b;
  // Original kite surfaces, five separate layers; meter-like internal units.
  for(let l=0;l<5;l++){
    const s=1-l*.018,y=l*.19;
    const coords=[[0,y,-10.5*s],[-6.9*s,y+.12,-2.4*s],[-6.5*s,y+.04,3*s],[0,y-.13,10.5*s],[6.5*s,y+.04,3*s],[6.9*s,y+.12,-2.4*s]];
    const membrane=geo('membrane',()=>{
    const g=new T.BufferGeometry(),p=[],idx=[],segments=36,rings=8;
    for(let j=0;j<=rings;j++)for(let k=0;k<segments;k++){
      const r=j/rings,edge=k/6,n=Math.floor(edge),t=edge-n,a=coords[n],c=coords[(n+1)%6];
      p.push((a[0]*(1-t)+c[0]*t)*r,y+.11*(1-r)+(a[1]*(1-t)+c[1]*t-y)*r+.022*Math.sin(r*39+k*.8)*r,(a[2]*(1-t)+c[2]*t)*r);
    }
    for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){
      const a=j*segments+k,c=j*segments+(k+1)%segments,d=c+segments,e=a+segments;
      idx.push(a,c,e,c,d,e,a,e,c,c,e,d);
    }
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);
    // Back-to-back thin faces use explicit normals instead of transparent foil.
    const ng=g.toNonIndexed();ng.computeVertexNormals();g.dispose();return ng;
    });
    put(membrane,l===4?'silver':'white',[0,y,0],[s,1,s]);
    for(let i=0;i<6;i++)rod('silver',coords[i],coords[(i+1)%6],.024);
    for(let i of [0,1,3,5])rod('silver',[0,y+.12,0],coords[i],.013);
  }
  B('gold',[0,-.5,0],[2.4,1,2.9]);B('black',[0,-1.06,0],[2.15,.12,2.6]);
  for(let x of [-1,1])for(let z of [-1.1,1.1])rod('silver',[x,-.8,z],[x*4,.25,z*6],.065);
  C('silver',[0,1.65,-1.55],.24,2.6);B('black',[0,3.4,-2.3],[2.2,3.1,.7]);
  const mirror=group('18-primary-mirror-segments',[0,4.6,-1.8]);
  const hex=geo('hex',()=>new T.CylinderGeometry(.745,.745,.085,6));
  // Axial hex ring of radius two, central segment omitted = 18 segments.
  const centers=[];
  for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.abs(q+r)<=2&&(q||r))centers.push([Math.sqrt(3)*.76*(q+r/2),1.5*.76*r]);
  centers.forEach(([x,y])=>{
    put(hex,'black',[x,y,-.12],[1.04,1.4,1.04],[PI/2,0,0],mirror);
    put(hex,'mirror',[x,y,0],[1,1,1],[PI/2,0,0],mirror);
    rod('black',[x,y,-.18],[x*.65,y*.65,-.65],.042,mirror);
  });
  B('black',[0,3.85,-1.32],[.8,.65,.75]);
  for(const p of [[-2.8,3,-1.75],[2.8,3,-1.75],[0,7.6,-1.75]])rod('black',p,[0,4.2,3.6],.07);
  C('mirror',[0,4.2,3.6],.36,.13,[PI/2,0,0]);
  C('black',[0,4.2,3.73],.42,.13,[PI/2,0,0]);
  b.dish(.65,[.4,-1.5,1],[PI,0,0]);panel(2.1,3.4,[0,-1.05,-3.5],[0,0,.2],b.content,8,10);
  return b.finish(REF.jwst,['遮熱膜のたわみ、裏面の補強と配線位置は見た目から補完。膜の間隔を強調。'],[.57,-.57,-.08]);
}

function parker(T,K){
  const b=builder(T,K),{B,C,rod,panel,group}=b;
  C('gold',[0,-.18,0],.52,1.5,[0,0,0],b.content,8);
  B('black',[0,-.7,.48],[.65,.4,.08]);B('silver',[0,.35,0],[.94,.14,.8]);
  // 11.43 cm shield on a 2.3 m diameter reference envelope.
  C('black',[0,.98,0],1.15,.1143,[0,PI/8,0],b.content,8);
  C('white',[0,1.042,0],1.143,.009,[0,PI/8,0],b.content,8);
  for(let i=0;i<6;i++){let t=i*TAU/6;rod('black',[Math.cos(t)*.4,.44,Math.sin(t)*.4],[Math.cos(t)*.85,.92,Math.sin(t)*.85],.036);}
  for(const s of [-1,1]){
    rod('silver',[s*.4,-.15,0],[s*.9,-.43,0],.04);
    panel(.95,.55,[s*1.13,-.53,0],[0,0,-s*.4],b.content,8,4);
    for(const z of [-.46,.46])rod('silver',[s*.5,-.6,z],[s*1.8,-1.2,z*1.7],.013);
    for(let y of [-.45,-.05,.3])B('black',[s*.51,y,.18],[.06,.22,.25]);
  }
  C('silver',[0,-1.02,0],.44,.12);b.dish(.37,[0,-1.14,0],[PI,0,0]);
  rod('silver',[0,-.65,-.3],[0,-2.2,-.62],.018);B('black',[0,-2.15,-.62],[.12,.12,.16]);
  for(let i=0;i<5;i++){let t=i*TAU/5;C('black',[Math.cos(t)*.44,-.83,Math.sin(t)*.44],.07,.17,[PI,0,0],b.content,12,.4);}
  for(const x of [-.23,.23])C('navy',[x,-.15,.53],.09,.07,[PI/2,0,0]);
  b.bolts([0,.43,0],.7,.65);
  return b.finish(REF.parker,['盾の支持骨格、裏側の計器、配線は簡略化。翼の角度は鑑賞用の近似。'],[.3,-.55,-.28]);
}

function bepicolombo(T,K){
  const b=builder(T,K),{B,C,rod,group,panel}=b;
  const mpo=group('MPO'),mosif=group('MOSIF',[0,1.3,0]),mio=group('Mio',[0,1.3,0]);
  // Colours follow ESA's "BepiColombo arrival at Mercury timeline" (white/grey stack after MTM separation).
  B('white',[0,0,0],[2.4,1.7,2.2],[0,0,0],mpo);
  B('silver',[0,.05,-1.14],[3.7,1.5,.08],[0,0,0],mpo);
  for(let x=-1.72;x<1.8;x+=.18)B('white',[x,.05,-1.197],[.025,1.37,.018],[0,0,0],mpo);
  for(const x of [-1.23,1.23])B('silver',[x,0,0],[.055,1.6,1.85],[0,0,0],mpo);
  for(let x of [-.8,0,.8])B('black',[x,-.08,1.112],[.45,.55,.025],[0,0,0],mpo);
  b.dish(.57,[-.72,.83,.72],[.75,0,.32],mpo);
  rod('silver',[1.2,.05,0],[1.65,.05,0],.065,mpo);
  // The single MPO wing extends 7.5 m from the bus. No MTM or MTM wings.
  for(let i=0;i<3;i++)panel(2.26,1.55,[2.31+i*2.36,.05,0],[0,0,.08],mpo,12,8);
  B('silver',[4.95,-.005,0],[7.5,.065,.12],[0,0,0],mpo);
  for(let x of [-.7,.7])for(let z of [-.7,.7])C('black',[x,-.95,z],.13,.24,[PI,0,0],mpo,12,.45);
  // Mio sits inside MOSIF, a white sunshield shell that widens towards its open top and leaves one side open.
  C('black',[0,.24,0],.9,1.1,[0,PI/8,0],mio,8);
  C('silver',[0,-.28,0],.91,.08,[0,PI/8,0],mio,8);
  C('silver',[0,.8,0],.91,.06,[0,PI/8,0],mio,8);
  const tilt=(a,t)=>{const e=new T.Euler().setFromRotationMatrix(new T.Matrix4().makeRotationY(a).multiply(new T.Matrix4().makeRotationX(t)));return [e.x,e.y,e.z];};
  const y0=-.55,y1=.95,r0=1.0,r1=1.25,slope=Math.atan2(r1-r0,y1-y0),k=1/Math.cos(PI/8);
  const open=new Set([0,1,7]); // the +Z side stays open, so Mio shows from the usual viewing side
  const corner=(j,y,r)=>{const a=j*TAU/8+PI/8;return [Math.sin(a)*r*k,y,Math.cos(a)*r*k];};
  for(let i=0;i<8;i++){
    const a=i*TAU/8,x=Math.sin(a),z=Math.cos(a),rm=(r0+r1)/2;
    B('solar',[x*.836,.32,z*.836],[.65,.8,.015],[0,a,0],mio);
    if(open.has(i))continue;
    B('white',[x*rm,(y0+y1)/2,z*rm],[2*rm*Math.tan(PI/8)+.02,(y1-y0)/Math.cos(slope),.05],tilt(a,-slope),mosif);
    for(const j of [i-1,i]){rod('silver',corner(j,y0,r0),corner(j,y1,r1),.022,mosif);}
    rod('silver',corner(i-1,y1,r1),corner(i,y1,r1),.02,mosif);
  }
  C('silver',[0,-.59,0],1.12,.08,[0,PI/8,0],mosif,8);
  C('white',[0,.95,0],.2,.15,[0,0,0],mio);
  return b.finish(REF.bepi,['色と MOSIF の形は ESA の到着の時刻表の図（白と灰色）に合わせた近似。MOSIF の内側、MPO 背面の計器・配線と固定具は近似。2026年10月4日の構成を表現。'],[.37,-.62,.07],{parts:{mpo,mosif,mio},configurationDate:'2026-10-04'});
}

function perseverance(T,K){
  const b=builder(T,K),{B,C,rod,ring,group}=b;
  B('white',[0,.6,0],[1.55,.5,2.08]);B('silver',[0,.89,0],[1.66,.09,2.15]);
  B('black',[0,.31,0],[1.18,.16,1.65]);
  for(const s of [-1,1]){
    B('white',[s*.81,.59,0],[.07,.34,1.65]);
    for(let j=0;j<9;j++)B('silver',[s*.86,.58,-.73+j*.18],[.015,.28,.022]);
    // Two connected rocker/bogie arms, three wheels per side.
    const h=[s*.88,.56,0],joint=[s*1.02,.32,.35];
    rod('black',h,[s*1.1,.02,-1.04],.071);rod('black',h,joint,.071);
    rod('silver',joint,[s*1.1,.02,.09],.062);rod('silver',joint,[s*1.1,.02,1.08],.062);
    C('silver',h,.13,.14,[0,0,PI/2]);
    for(let z of [-1.04,.09,1.08]){
      const wheel=group('wheel',[s*1.11,0,z],[0,0,PI/2]);
      C('black',[0,0,0],.32,.28,[0,0,0],wheel,40);
      for(let yy of [-.146,.146]){
        ring('silver',[0,yy,0],.245,.019,[PI/2,0,0],wheel);
        C('silver',[0,yy,0],.071,.026,[0,0,0],wheel,16);
        for(let j=0;j<6;j++){const a=j*TAU/6;rod('silver',[0,yy,0],[Math.sin(a)*.24,yy,Math.cos(a)*.24],.017,wheel);}
      }
      // Independent raised grousers instead of a smooth toy tire.
      for(let j=0;j<32;j++){let a=j*TAU/32;B('silver',[Math.sin(a)*.321,0,Math.cos(a)*.321],[.012,.265,.014],[0,a,0],wheel);}
    }
  }
  // Remote sensing mast and two camera eyes.
  C('white',[-.48,1.41,-.62],.085,1.0);
  B('white',[-.48,1.97,-.62],[.62,.31,.32]);B('black',[-.48,2.01,-.81],[.57,.14,.03]);
  for(const x of [-.64,-.32]){C('black',[x,1.97,-.84],.081,.09,[PI/2,0,0]);C('navy',[x,1.97,-.897],.061,.012,[PI/2,0,0]);}
  C('black',[-.48,2.21,-.65],.091,.15);C('silver',[-.48,1.72,-.61],.14,.1);
  // Folded front arm and instrument turret, not a flag panel.
  rod('white',[.5,.65,-1.03],[.7,.37,-1.44],.09);
  rod('silver',[.7,.37,-1.44],[-.47,.37,-1.42],.07);
  for(let x of [-.47,.7])C('silver',[x,.38,-1.43],.13,.15,[PI/2,0,0]);
  C('white',[-.62,.42,-1.45],.22,.25,[0,0,0],b.content,12);
  for(let i=0;i<4;i++){let a=i*PI/2;C('black',[-.62+Math.cos(a)*.17,.29,-1.45+Math.sin(a)*.17],.044,.11);}
  const power=group('rear-power',[0,1.02,1.08],[.5,0,0]);b.rtg([0,0,0],[0,0,0],power,.78);
  for(const s of [-1,1])rod('white',[s*.42,.85,.64],[s*.28,1.47,1.32],.055);
  b.dish(.23,[.5,1.04,.05],[.2,0,.25]);
  C('white',[.55,1.06,-.72],.12,.28);rod('black',[.68,.93,.72],[.68,1.9,.72],.011);
  B('white',[-.48,1.02,.48],[.48,.2,.38]);B('gold',[.1,.956,-.4],[.25,.018,.28]);
  for(let x of [-.52,0,.52])for(let z of [-.76,0,.76])b.bolts([x,.95,z],.34,.3);
  for(let i=0;i<4;i++)C('silver',[-.45+i*.3,.96,.77],.055,.06);
  for(const [x,z,w,h] of [[.22,-.65,.31,.17],[-.28,.12,.32,.12],[.48,.52,.24,.2]]){
    B('white',[x,1+h/2,z],[w,h,.25]);B('black',[x,1+h+.005,z],[w*.8,.015,.18]);
    for(let n=0;n<4;n++)B('silver',[x-w*.32+n*w*.21,1+h+.019,z],[.012,.012,.15]);
  }
  for(const s of [-1,1]){
    rod('gold',[s*.65,.97,-.9],[s*.65,.97,.73],.015);
    rod('gold',[s*.65,.97,-.9],[s*.32,1.01,-.91],.015);
    for(let z of [-.62,-.07,.46])B('silver',[s*.65,.98,z],[.055,.025,.035]);
  }
  B('silver',[-.49,2.035,-.63],[.63,.035,.34]);
  for(const x of [-.7,-.26])C('black',[x,2.065,-.815],.024,.035,[PI/2,0,0]);
  return b.finish(REF.rover,['車輪の溝数、腹面の機器、アームの関節・配線は簡略化。旗とヘリコプターは省略。'],[.27,-2.45,0]);
}

function mmx(T,K){
  // 単位はメートルの目安（finish でいちばん長い辺を 2 にそろえる）。+Y が上。下から 探査モジュール（脚）・復路モジュール（太陽電池パドル・アンテナ）・往路モジュール（推進）。
  // 公表された事実：3モジュール構成、着陸脚4本、太陽電池パドルの端から端まで約9 m、本体 約3.4×3.9×4.9 m。形は公式の写真・構成図を見て独自に組み立てた（なぞっていない）
  const b=builder(T,K),{B,C,rod,group,panel,ring,ball}=b;
  const explore=group('explore'),ret=group('return'),outbound=group('outbound');
  // ---------- 探査モジュール（y 0.95〜1.75） ----------
  const ey=1.35;
  B('goldMLI',[0,ey,0],[1.5,.8,1.4],[0,0,0],explore);
  // 星を見て向きを知るカメラ（スタートラッカー）と、小さなアンテナ（目安）
  for(const x of [-.4,-.15])C('black',[x,ey+.47,-.6],.07,.14,[-.5,0,0],explore,12);
  B('black',[0,.94,0],[1.44,.03,1.34],[0,0,0],explore);              // フォボスに向く面
  B('foilSilver',[0,ey+.05,.705],[.9,.5,.02],[0,0,0],explore);        // 放熱面
  B('black',[-.6,ey-.1,-.705],[.25,.35,.03],[0,0,0],explore);
  // ローバ（IDEFIX）を側面に抱える（位置は目安）
  const rover=group('rover',[-.86,ey-.05,.15],[0,0,0],explore);
  B('silver',[0,0,0],[.22,.34,.5],[0,0,0],rover);B('solar',[-.12,0,0],[.02,.3,.46],[0,0,0],rover);
  for(const z of [-.2,.2])for(const y of [-.15,.15])C('black',[-.06,y,z],.06,.04,[0,0,PI/2],rover,12);
  // 観測機器・サンプラ（目安）
  B('copper',[.5,ey+.1,-.73],[.3,.26,.08],[0,0,0],explore);
  for(const [x,z] of [[.35,.3],[-.25,-.35],[.1,-.1]])C('black',[x,.86,z],.07,.16,[0,0,0],explore,16);
  C('silver',[.45,.82,-.25],.05,.3,[0,0,0],explore,12);
  // 着陸脚4本（写真から）：各面の真ん中、フォボスに向く面のふちから出る。太い主の支柱（付け根の近くに関節、蛇腹2か所）と、
  // その両わきからのV字の2本が、丸い足に集まる。足は胴体の幅の約1.4倍下、端から端で約1.75倍（写真の比の目安）
  const lerp3=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
  for(let i=0;i<4;i++){
    const a=i*PI/2,ca=Math.cos(a),sa=Math.sin(a),tx=-sa,tz=ca,half=i%2?.7:.75;
    const foot=[ca*1.5,-.9,sa*1.5];
    const base=[ca*(half-.08),.97,sa*(half-.08)];
    const seg=(t0,t1,r)=>rod('black',lerp3(base,foot,t0),lerp3(base,foot,t1),r,explore,12);
    seg(0,.2,.088);
    B('black',lerp3(base,foot,.24),[.21,.21,.21],[0,a,0],explore);                 // 関節
    seg(.28,.42,.088);
    for(let k=0;k<8;k++)seg(.42+k*.026,.42+(k+.55)*.026,k%2?.09:.115);             // 蛇腹（長い）
    seg(.63,.78,.088);
    for(let k=0;k<4;k++)seg(.78+k*.024,.78+(k+.55)*.024,k%2?.09:.11);              // 蛇腹（短い）
    seg(.875,1,.088);
    for(const s of [-1,1]){const b2=[ca*(half-.04)+tx*s*.55,.97,sa*(half-.04)+tz*s*.55];rod('black',b2,lerp3(base,foot,.97),.062,explore,10);}
    // 丸い足（放射状の筋）
    const fp=group('footpad',[foot[0],foot[1]-.07,foot[2]],[0,0,0],explore);
    C('silver',[0,-.02,0],.3,.04,[0,0,0],fp,28);
    C('silver',[0,.03,0],.19,.07,[0,0,0],fp,24,.55);
    for(let k=0;k<12;k++){const t=k*TAU/12;B('silver',[Math.cos(t)*.18,.01,Math.sin(t)*.18],[.23,.03,.014],[0,-t,0],fp);}
    C('black',[0,.1,0],.11,.07,[0,0,0],fp,16);
  }
  // ---------- 復路モジュール（y 1.75〜3.05） ----------
  const ry=2.4;
  B('goldMLI',[0,ry,0],[1.9,1.3,1.7],[0,0,0],ret);
  B('olive',[-.2,ry+.1,-.86],[1.2,.85,.02],[0,0,0],ret);                 // 暗い緑がかった灰色の板（放熱面とみられる）
  // 金色のふちの円筒に、黄色がかったドーム（写真で目立つ装置。何の装置かは確かめていないので形だけ）
  C('goldMLI',[.55,ry-.36,-1.0],.34,.3,[PI/2,0,0],ret,28);ring('gold',[.55,ry-.36,-1.15],.34,.04,[0,0,0],ret);
  ball('mirror',[.55,ry-.36,-1.14],[.3,.3,.13],ret);
  B('white',[.96,ry-.25,.3],[.02,.5,.7],[0,0,0],ret);
  B('black',[-.5,ry+.5,.86],[.6,.22,.02],[0,0,0],ret);
  // 側面の機器・放熱面（目安）
  B('black',[-.98,ry+.2,-.35],[.08,.5,.6],[0,0,0],ret);B('white',[-.97,ry-.3,.45],[.04,.45,.5],[0,0,0],ret);
  B('foilSilver',[.6,ry+.68,-.4],[.5,.08,.6],[0,0,0],ret);C('black',[-.45,ry+.72,.35],.14,.14,[0,0,0],ret,16);
  B('copper',[.55,ry-.45,-.87],[.32,.25,.06],[0,0,0],ret);
  for(const z of [-.5,.1,.6])rod('silver',[-.95,ry-.6,z],[-.95,ry+.6,z],.012,ret,6);
  // 帰りのエンジン（往路モジュールの陰。切り離すと見える。数・位置は目安）
  for(const x of [-.32,.32])C('mirror',[x,ry+.72,0],.14,.24,[PI,0,0],ret,16,.35);
  // 断熱材のしわ（少し傾けた当て布で、照り返しにむらを出す）
  {let sd=7;const rr=()=>((sd=(sd*16807)%2147483647)/2147483647);
   for(let k=0;k<14;k++){const f=k%4,u=rr()-.5,v=rr()-.5,w=.25+rr()*.35,h=.2+rr()*.3,tilt=(rr()-.5)*.35;
     if(f===0)B('goldMLI',[u*1.5,ry+v*1.0,.858],[w,h,.012],[tilt,tilt*.6,0],ret);
     else if(f===1)B('goldMLI',[.958,ry+v*1.0,u*1.3],[.012,h,w],[0,tilt,tilt*.6],ret);
     else if(f===2)B('goldMLI',[u*1.2,ey+v*.6,-.708],[w*.8,h*.8,.012],[tilt,tilt*.6,0],explore);
     else B('goldMLI',[-.758,ey+v*.6,u*1.0],[.012,h*.8,w*.8],[0,tilt,tilt*.6],explore);}}
  // 大きなアンテナの皿と、小さな皿
  const hga=b.dish(.78,[.25,ry+.34,1.18],[PI/2-.25,0,0],ret,'silver');
  rod('silver',[.25,ry+.3,.86],[.25,ry+.32,1.08],.07,ret,12);B('black',[.25,ry+.3,.9],[.3,.3,.08],[0,0,0],ret);
  b.dish(.2,[-.6,ry-.25,.86],[PI/2,0,0],ret,'white');
  // 姿勢を変える小さな噴射口（四隅）
  for(const x of [-.95,.95])for(const z of [-.85,.85])for(const y of [ry-.66,ry+.66]){
    C('gold',[x*1.02,y,z*1.02],.05,.12,[y>ry?0:PI,0,0],ret,10,.4);
  }
  // 太陽電池パドル：片側3枚。つけ根の腕から、細長く伸びる
  for(const s of [-1,1]){
    rod('silver',[s*.95,ry+.25,0],[s*1.42,ry,0],.035,ret,8);rod('silver',[s*.95,ry-.25,0],[s*1.42,ry,0],.035,ret,8);rod('silver',[s*.95,ry,0],[s*1.42,ry,0],.045,ret,10);
    B('silver',[s*1.42,ry,0],[.08,.3,.12],[0,0,0],ret);
    for(let k=0;k<3;k++){
      const x=s*(1.5+.53+k*1.08);
      panel(1.02,1.5,[x,ry,0],[PI/2,0,0],ret,6,9,'solarThin','graphite');
      if(k<2)B('silver',[s*(1.5+1.07+k*1.08),ry,0],[.06,1.4,.04],[0,0,0],ret);
    }
  }
  // ---------- 往路モジュール（y 3.05〜4.45） ----------
  const oy=3.68;
  C('goldMLI',[0,oy,0],.95,1.2,[0,0,0],outbound,14);
  C('goldMLI',[0,oy+.66,0],.8,.12,[0,0,0],outbound,14);
  // 縦長のタンク（銀色の断熱材）と、横のふくらみ
  for(const t of [.3,PI+.3]){C('foilSilver',[Math.cos(t)*.86,oy,Math.sin(t)*.86],.3,1.05,[0,0,0],outbound,16);
    ball('foilSilver',[Math.cos(t)*.86,oy+.52,Math.sin(t)*.86],[.3,.12,.3],outbound);ball('foilSilver',[Math.cos(t)*.86,oy-.52,Math.sin(t)*.86],[.3,.12,.3],outbound);}
  for(const t of [PI/2+.2,-PI/2+.2]){B('goldMLI',[Math.cos(t)*1.0,oy-.2,Math.sin(t)*1.0],[.55,.55,.45],[0,-t,0],outbound);
    B('foilSilver',[Math.cos(t)*1.28,oy-.32,Math.sin(t)*1.28],[.5,.16,.2],[0,-t,0],outbound);}
  // ロケットとつなぐ輪と、主エンジンの噴射口
  C('silver',[0,oy+.82,0],.62,.2,[0,0,0],outbound,32);
  C('copper',[0,oy+.9,0],.56,.03,[0,0,0],outbound,32);
  ring('silver',[0,oy+.93,0],.64,.02,[PI/2,0,0],outbound);
  // 主エンジンの噴射口（4つ。少し外へ開く）
  for(let i=0;i<4;i++){const t=PI/4+i*PI/2,ct=Math.cos(t),st=Math.sin(t);C('mirror',[ct*.8,oy+.92,st*.8],.22,.46,[PI-st*.18,0,ct*.18],outbound,20,.3);
    C('black',[ct*.76,oy+.66,st*.76],.09,.12,[0,0,0],outbound,12);}
  // 横向きの小さな噴射口
  for(const t of [PI/2+.2,-PI/2+.2])for(const dy of [-.45,.05]){const ct=Math.cos(t),st=Math.sin(t);C('mirror',[ct*1.32,oy+dy,st*1.32],.07,.18,[0,0,0],outbound,12,.35);}
  // モジュールのあいだの輪
  C('silver',[0,3.06,0],.7,.05,[0,0,0],outbound,32);
  C('silver',[0,1.76,0],.62,.04,[0,0,0],ret,32);
  return b.finish(REF.mmx,[
    '公式の写真・構成図（JAXA MMX 公式サイトのギャラリー、プレスキット）を見て、独自に組み立てた。図面・3Dデータはなぞっていない。',
    '寸法は公表値（太陽電池パドルの端から端まで約9 m、本体 約3.4×3.9×4.9 m）の比の目安。各モジュールの大きさ、脚の付け根、アンテナ・噴射口・観測機器・ローバの位置は近似。'
  ],[.3,-.6,.05],{parts:{outbound,explore,return:ret}});
}

function hayabusa2(T,K){
  const b=builder(T,K),{B,C,rod,panel}=b;
  B('gold',[0,0,0],[1.05,1.16,.95]);
  for(const x of [-.48,.48]){B('silver',[x,0,.488],[.035,1.1,.025]);B('silver',[x,0,-.488],[.035,1.1,.025]);}
  for(const s of [-1,1]){
    b.truss([s*.5,.12,0],[s*.94,.12,0],.08);
    for(let i=0;i<2;i++)panel(.85,1.35,[s*(1.34+i*.9),.12,0],[0,0,.04*s],b.content,8,10);
  }
  // Flat high- and medium-gain antennas, rather than parabolic dishes.
  for(const [x,r] of [[-.27,.29],[.3,.24]]){
    C('silver',[x,.7,0],.07,.2);C('white',[x,.82,0],r,.035);
    b.ring('silver',[x,.84,0],r,.012,[PI/2,0,0]);
  }
  C('black',[0,-.95,.2],.085,.7);C('silver',[0,-1.36,.2],.18,.16,[0,0,0],b.content,24,.45);
  for(let y=-1.2;y<-.62;y+=.075)C('silver',[0,y,.2],.091,.009);
  B('black',[0,0,-.5],[.67,.63,.07]);
  for(let x of [-.18,.18])for(let y of [-.18,.18]){
    C('silver',[x,y,-.565],.139,.11,[PI/2,0,0]);C('black',[x,y,-.629],.112,.014,[PI/2,0,0]);
    b.ring('silver',[x,y,-.645],.08,.009);
  }
  for(const [x,y,r] of [[-.3,.2,.09],[.13,.32,.07],[.3,-.18,.1]]){
    C('black',[x,y,.535],r,.09,[PI/2,0,0]);C('navy',[x,y,.589],r*.7,.014,[PI/2,0,0]);
  }
  for(let x of [-.3,.28])B('black',[x,-.38,.5],[.22,.18,.03]);
  rod('silver',[.4,.4,-.3],[.57,1.25,-.5],.012);
  for(let x of [-.42,.42])for(let z of [-.35,.35])C('silver',[x,-.64,z],.045,.14,[0,0,0],b.content,12,.5);
  b.bolts([0,.586,0],.83,.7);
  return b.finish(REF.haya,['裏面のイオンエンジン細部、配線・小型計器は近似。帰還カプセルは付けていない。'],[.42,-.6,-.08]);
}

function juno(T,K){
  const b=builder(T,K),{B,C,rod,group,panel}=b;
  C('gold',[0,0,0],1.75,3.5,[0,PI/6,0],b.content,6);
  C('black',[0,1.73,0],1.78,.1,[0,PI/6,0],b.content,6);
  b.dish(1.25,[0,1.77,0],[0,0,0],b.content,'silver');
  C('silver',[0,-1.89,0],.55,.27);C('black',[0,-2.12,0],.43,.3,[0,0,0],b.content,24,.4);
  for(let i=0;i<3;i++){
    const wing=group('radial-wing',[0,0,0],[0,i*TAU/3,0]);
    rod('silver',[0,0,1.45],[0,0,2.2],.12,wing);
    // Three articulated bays per 9 m radial wing.
    for(let j=0;j<3;j++)panel(2.65,2.85,[0,0,2.965+j*2.96],[0,0,0],wing,10,14);
    for(const x of [-1.26,1.26])rod('silver',[x,-.07,1.75],[x,-.07,10.25],.035,wing);
    if(i===0){b.truss([0,0,10.25],[0,0,11.15],.2,wing);B('white',[0,.05,11.2],[.7,.24,.55],[0,0,0],wing);}
  }
  for(let i=0;i<6;i++){let a=i*TAU/6;B('black',[Math.sin(a)*1.54,.1,Math.cos(a)*1.54],[.6,1.5,.06],[0,a,0]);}
  rod('silver',[1.2,-.6,0],[3,-2.3,-1],.025);rod('silver',[-1.2,-.6,0],[-3,-2.3,-1],.025);
  B('white',[.9,.9,1.4],[.5,.4,.2]);
  return b.finish(REF.juno,['翼のセル分割、背面機器・配線を簡略化。翼端の磁力計架台は写真から近似。'],[.82,-.22,.12],{spinAxis:[0,1,0]});
}

function newHorizons(T,K){
  const b=builder(T,K),{B,C,rod}=b;
  const shape=new T.Shape();shape.moveTo(-.85,-.65);shape.lineTo(.95,-.48);shape.lineTo(-.35,.83);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.65,bevelEnabled:false});g.rotateX(-PI/2);g.translate(0,-.325,0);
  b.put(g,'gold');B('silver',[0,-.36,0],[1.1,.04,.8]);
  b.dish(.74,[-.2,.47,.02],[.02,0,.02]);
  C('gold',[-.2,.32,.02],.35,.2);
  rod('silver',[-.5,.02,-.42],[-1.04,.02,-.54],.1);
  b.rtg([-1.3,.02,-.54],[0,0,PI/2],b.content,1.1);
  B('black',[.59,.19,-.25],[.3,.38,.32]);C('black',[.57,.43,-.27],.16,.31);C('navy',[.57,.595,-.27],.13,.019);
  B('white',[.37,.34,.34],[.34,.022,.28]);B('navy',[.32,.02,.69],[.28,.24,.027]);
  for(let p of [[-.42,-.37,.45],[.55,-.37,-.4],[-.67,-.37,-.41]])C('black',p,.067,.18,[0,0,0],b.content,12,.4);
  C('white',[.24,.38,-.38],.21,.04);
  rod('gold',[.72,-.08,-.23],[.82,.63,-.23],.022);
  b.bolts([-.45,.333,-.4],.5,.25);
  return b.finish(REF.nh,['三角形バスの裏面、観測機器の奥行き、配線・固定具は近似。RTGは1基。'],[.43,-.55,-.15]);
}

function voyager(T,K){
  const b=builder(T,K),{B,C,rod,group}=b;
  C('black',[0,0,0],.8,.55,[0,PI/10,0],b.content,10);
  C('silver',[0,-.27,0],.83,.06,[0,PI/10,0],b.content,10);
  for(let i=0;i<10;i++){
    const a=i*TAU/10;B(i%3?'black':'gold',[Math.sin(a)*.77,0,Math.cos(a)*.77],[.38,.43,.018],[0,a,0]);
    rod('silver',[Math.sin(a)*.8,-.23,Math.cos(a)*.8],[Math.sin(a)*.8,.22,Math.cos(a)*.8],.018);
  }
  b.dish(1.8,[0,.55,0]);C('silver',[0,.38,0],.55,.28);
  // The instrument platform and RTG boom extend on opposite sides.
  b.truss([.55,0,0],[2.72,.18,.1],.17);
  const platform=group('scan-platform',[2.78,.2,.1],[0,.1,.15]);
  B('silver',[0,0,0],[.7,.1,.65],[0,0,0],platform);
  for(let x of [-.22,.22]){
    C('black',[x,.23,0],.15,.4,[PI/2,0,0],platform);
    C('navy',[x,.23,.215],.124,.012,[PI/2,0,0],platform);
  }
  B('white',[0,.3,-.32],[.23,.34,.2],[0,0,0],platform);
  b.truss([-.6,-.1,0],[-1.45,-.33,0],.13);
  const rtgs=group('three-RTGs',[-1.45,-.33,0],[0,0,PI/2]);
  for(let i=0;i<3;i++)b.rtg([0,.43+i*.88,0],[0,0,0],rtgs,.9);
  b.truss([-.3,-.12,-.5],[-1.25,-.7,-5.7],.12);
  B('black',[-1.25,-.7,-5.74],[.2,.2,.15]);
  for(const s of [-1,1])rod('silver',[s*.32,-.2,0],[s*2.5,-2.4,1.1],.012);
  // Plain gold record: no etching, inscription, badge, flag or organization mark.
  C('mirror',[0,-.025,.79],.26,.025,[PI/2,0,0]);
  for(let x of [-.45,.45])C('black',[x,-.4,.24],.065,.18,[PI,0,0],b.content,12,.5);
  return b.finish(REF.voyager,['観測台の小型機器、ブームの格子・配線を簡略化。レコードは無地。1号と2号で共有。'],[.6,-.7,-.19]);
}

export const MODELS={jwst,'parker-solar-probe':parker,bepicolombo,perseverance,mmx,hayabusa2,juno,'new-horizons':newHorizons,voyager};

export function disposeModel(group){
  const seen=new Set();group.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});
}
