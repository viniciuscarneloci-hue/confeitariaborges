# Gera modelos .glb de bolo (redondo e quadrado) em escala real (metros), com fatia cortada
# para mostrar as camadas. Materiais nomeados para o app tingir por sabor:
#   massa, recheio, cobertura, decoracao, base
import numpy as np, json, struct, math, sys

class Mesh:
    def __init__(s): s.P=[]; s.N=[]; s.I=[]
    def quad(s,a,b,c,d,n):
        k=len(s.P); s.P+= [a,b,c,d]; s.N+=[n]*4; s.I+=[k,k+1,k+2,k,k+2,k+3]
    def tri_fan(s,center,ring,n):
        k=len(s.P); s.P.append(center); s.N.append(n)
        for p in ring: s.P.append(p); s.N.append(n)
        for i in range(len(ring)-1): s.I+=[k,k+1+i,k+2+i]

def norm(v):
    v=np.array(v,float); return list(v/np.linalg.norm(v))

def wedge_band(m, r, y0, y1, t0, t1, seg=72, top=True, bottom=False, cuts=True):
    ts=np.linspace(t0,t1,seg)
    P=lambda t,y,rr=r: [rr*math.cos(t), y, rr*math.sin(t)]
    for a,b in zip(ts[:-1],ts[1:]):
        n=norm([math.cos((a+b)/2),0,math.sin((a+b)/2)])
        m.quad(P(a,y0),P(a,y1),P(b,y1),P(b,y0),n)
    if top:
        m.tri_fan([0,y1,0],[P(t,y1) for t in ts[::-1]],[0,1,0])
    if bottom:
        m.tri_fan([0,y0,0],[P(t,y0) for t in ts],[0,-1,0])
    if cuts:
        # face de corte em t0 e t1
        for t,sgn in ((t0,1),(t1,-1)):
            n=norm([ -math.sin(t)*-sgn*-1, 0, math.cos(t)*-sgn*-1 ])
            # normal perpendicular ao plano radial, apontando para fora da fatia removida
            n=norm([math.sin(t)*sgn, 0, -math.cos(t)*sgn])
            a=[0,y0,0]; b=[0,y1,0]; c=P(t,y1); d=P(t,y0)
            if sgn>0: m.quad(a,b,c,d,n)
            else: m.quad(d,c,b,a,n)

def box(m, x0,x1,y0,y1,z0,z1, faces="xXyYzZ"):
    if 'X' in faces: m.quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],[1,0,0])
    if 'x' in faces: m.quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],[-1,0,0])
    if 'Y' in faces: m.quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[0,1,0])
    if 'y' in faces: m.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0])
    if 'Z' in faces: m.quad([x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1],[0,0,1])
    if 'z' in faces: m.quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],[0,0,-1])

def sphere(m, c, r, sy=1.0, seg=14, ring=10, swirl=0.0):
    k=len(m.P)
    for i in range(ring+1):
        v=i/ring; ph=v*math.pi
        for j in range(seg+1):
            u=j/seg; th=u*2*math.pi
            rr=r*(1+swirl*math.sin(th*5+ph*3)*0.12)
            n=[math.sin(ph)*math.cos(th), math.cos(ph), math.sin(ph)*math.sin(th)]
            # gota de chantilly: afina no topo
            taper = 1.0 if n[1]<0.2 else max(0.25,1-(n[1]-0.2)*0.9)
            m.P.append([c[0]+rr*n[0]*taper, c[1]+r*sy*n[1], c[2]+rr*n[2]*taper]); m.N.append(n)
    for i in range(ring):
        for j in range(seg):
            a=k+i*(seg+1)+j; b=a+seg+1
            m.I+=[a,b,a+1,b,b+1,a+1]

def cylinder(m, r, y0, y1, seg=72, cx=0, cz=0):
    ts=np.linspace(0,2*math.pi,seg+1)
    for a,b in zip(ts[:-1],ts[1:]):
        n=norm([math.cos((a+b)/2),0,math.sin((a+b)/2)])
        m.quad([cx+r*math.cos(a),y0,cz+r*math.sin(a)],[cx+r*math.cos(a),y1,cz+r*math.sin(a)],
               [cx+r*math.cos(b),y1,cz+r*math.sin(b)],[cx+r*math.cos(b),y0,cz+r*math.sin(b)],n)
    m.tri_fan([cx,y1,cz],[[cx+r*math.cos(t),y1,cz+r*math.sin(t)] for t in ts[::-1]],[0,1,0])

def berry(m, c, r):
    sphere(m,c,r,sy=1.25,seg=12,ring=8)

def write_glb(path, meshes, mats):
    # meshes: list of (name, Mesh, material_index)
    bin=bytearray(); views=[]; accs=[]; gmeshes=[]; nodes=[]
    def add(data, target, comp, typ, count, mn=None, mx=None):
        while len(bin)%4: bin.append(0)
        off=len(bin); bin.extend(data)
        views.append({"buffer":0,"byteOffset":off,"byteLength":len(data),"target":target})
        a={"bufferView":len(views)-1,"componentType":comp,"count":count,"type":typ}
        if mn is not None: a["min"]=mn; a["max"]=mx
        accs.append(a); return len(accs)-1
    for name,m,mi in meshes:
        P=np.array(m.P,np.float32); N=np.array(m.N,np.float32); I=np.array(m.I,np.uint32)
        pa=add(P.tobytes(),34962,5126,"VEC3",len(P),P.min(0).tolist(),P.max(0).tolist())
        na=add(N.tobytes(),34962,5126,"VEC3",len(N))
        ia=add(I.tobytes(),34963,5125,"SCALAR",len(I))
        gmeshes.append({"name":name,"primitives":[{"attributes":{"POSITION":pa,"NORMAL":na},"indices":ia,"material":mi}]})
        nodes.append({"name":name,"mesh":len(gmeshes)-1})
    while len(bin)%4: bin.append(0)
    gltf={"asset":{"version":"2.0","generator":"borges-piloto"},"scene":0,
          "scenes":[{"nodes":list(range(len(nodes)))}],"nodes":nodes,"meshes":gmeshes,
          "materials":mats,"accessors":accs,"bufferViews":views,"buffers":[{"byteLength":len(bin)}]}
    js=json.dumps(gltf,separators=(',',':')).encode()
    while len(js)%4: js+=b' '
    out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin))
    out+=struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin),0x004E4942)+bytes(bin)
    open(path,'wb').write(out)

def mat(name,rgb,rough=0.7,metal=0.0,double=True):
    return {"name":name,"doubleSided":double,"pbrMetallicRoughness":{"baseColorFactor":rgb+[1.0],"roughnessFactor":rough,"metallicFactor":metal}}

MATS=[mat("massa",[0.96,0.86,0.62]), mat("recheio",[0.98,0.94,0.85]), mat("cobertura",[0.99,0.98,0.96],0.55),
      mat("decoracao",[0.80,0.10,0.15],0.4), mat("base",[0.83,0.66,0.30],0.35,0.8)]
M_MASSA,M_REC,M_COB,M_DEC,M_BASE=range(5)

def round_cake(path):
    R=0.10; H=0.10; base_h=0.006; f=0.006  # 20cm diâmetro, 10cm altura
    t0, t1 = math.radians(20), math.radians(20+300)  # tira 60°
    mass=Mesh(); rec=Mesh(); cob=Mesh(); dec=Mesh(); base=Mesh()
    cylinder(base, R+0.03, 0, base_h, seg=96)
    layers=[('m',0.026),('r',0.010),('m',0.022),('r',0.010),('m',0.022)]
    y=base_h
    for k,h in layers:
        wedge_band(mass if k=='m' else rec, R, y, y+h, t0, t1, top=False, bottom=False)
        y+=h
    top=y
    # cobertura: parede externa + topo (sem tampar o corte), e faixa fina no corte
    wedge_band(cob, R+f, base_h, top+f, t0, t1, top=True, cuts=False)
    for t,sgn in ((t0,1),(t1,-1)):
        n=norm([math.sin(t)*sgn,0,-math.cos(t)*sgn])
        P=lambda rr,yy:[rr*math.cos(t),yy,rr*math.sin(t)]
        q=[P(R,base_h),P(R,top),P(R+f,top+f),P(R+f,base_h)]
        if sgn<0: q=q[::-1]
        cob.quad(*q,n)
        q=[P(0,top),P(0,top+f),P(R+f,top+f),P(R,top)]
        if sgn<0: q=q[::-1]
        cob.quad(*q,n)
    # gotas de chantilly na borda e frutas
    ts=np.linspace(t0+0.12,t1-0.12,14)
    for i,t in enumerate(ts):
        c=[(R-0.008)*math.cos(t), top+f+0.004, (R-0.008)*math.sin(t)]
        sphere(cob,c,0.011,sy=1.4,swirl=1)
        if i%2==0: berry(dec,[(R-0.035)*math.cos(t), top+f+0.009,(R-0.035)*math.sin(t)],0.009)
    sphere(dec,[0.015,top+f+0.01,0.0],0.014,sy=1.1)
    write_glb(path,[("base",base,M_BASE),("massa",mass,M_MASSA),("recheio",rec,M_REC),("cobertura",cob,M_COB),("decoracao",dec,M_DEC)],MATS)

def square_cake(path):
    W=0.18; D=0.14; base_h=0.006; f=0.006
    x0,x1=-W/2,W/2; z0,z1=-D/2,D/2
    xc = x1-0.045  # fatia retirada na frente direita: corta em x>xc
    mass=Mesh(); rec=Mesh(); cob=Mesh(); dec=Mesh(); base=Mesh()
    box(base,x0-0.03,x1+0.03,0,base_h,z0-0.03,z1+0.03)
    layers=[('m',0.024),('r',0.010),('m',0.022),('r',0.010),('m',0.022)]
    y=base_h
    for k,h in layers:
        box(mass if k=='m' else rec, x0,xc,y,y+h,z0,z1, faces="X")
        y+=h
    top=y
    # cobertura: casca em volta (sem a face de corte em X)
    box(cob,x0-f,xc,base_h,top+f,z0-f,z1+f, faces="xYzZ")
    box(cob,xc,xc+0.0005,top,top+f,z0-f,z1+f, faces="X")
    box(cob,xc,xc+0.0005,base_h,top,z1,z1+f, faces="X")
    box(cob,xc,xc+0.0005,base_h,top,z0-f,z0, faces="X")
    for i in range(9):
        for zz in (z0+0.004,z1-0.004):
            xx=x0+0.01+i*((xc-x0-0.02)/8)
            sphere(cob,[xx,top+f+0.004,zz],0.009,sy=1.4,swirl=1)
    for i in range(5):
        berry(dec,[x0+0.03+i*((xc-x0-0.06)/4), top+f+0.009, 0.0],0.0095)
    write_glb(path,[("base",base,M_BASE),("massa",mass,M_MASSA),("recheio",rec,M_REC),("cobertura",cob,M_COB),("decoracao",dec,M_DEC)],MATS)

round_cake(sys.argv[1]+"/bolo-redondo.glb")
square_cake(sys.argv[1]+"/bolo-quadrado.glb")
print("ok")
