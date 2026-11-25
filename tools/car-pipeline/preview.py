import numpy as np, sys
from PIL import Image, ImageDraw
name=sys.argv[1]
a=np.fromfile(name+'_pts.bin',dtype=np.float32).reshape(-1,7)
P=a[:,:3]; C=(np.clip(a[:,3:6],0,1)*255).astype(np.uint8); G=a[:,6]
mn=P.min(0); mx=P.max(0); ext=mx-mn
print(name,'extent x,y,z =',ext, 'min',mn,'max',mx)
S=420
def view(ax,ay,flipx=False,title=''):
    img=Image.new('RGB',(S,S),(245,245,245)); px=img.load()
    sc=(S-40)/max(ext[ax],ext[ay])
    order=np.argsort(P[:,3-ax-ay]) # painter by remaining axis
    for i in order:
        x=int(20+(P[i,ax]-mn[ax])*sc); y=int(S-20-(P[i,ay]-mn[ay])*sc)
        col=(30,60,90) if G[i]>0 else tuple(int(v) for v in C[i])
        for dx in (0,1):
            for dy in (0,1):
                if 0<=x+dx<S and 0<=y+dy<S: px[x+dx,y+dy]=col
    d=ImageDraw.Draw(img); d.text((6,6),title,fill=(200,0,0))
    return img
tiles=[view(0,2,title='TOP: horizontal=X  vertical=Z (up=+Z)'), view(2,1,title='SIDE: horizontal=Z vertical=Y(up)'), view(0,1,title='FRONT: horizontal=X vertical=Y')]
W=Image.new('RGB',(S*3,S)); [W.paste(t,(i*S,0)) for i,t in enumerate(tiles)]
W.save(name+'_prev.png')
