import random, math
random.seed(7)
S=1024; cx=S/2
SPINES=['#6b3a1f','#8a4b22','#a8682e','#c08a45','#d9b77a','#e8d7b0','#2f4f6f','#1f3a5a','#7a2a1e','#5a3416','#b0773a','#3d2412']
BACK=['#2f5577','#3b6a8f','#1f3a5a','#c9a465','#8a4b22','#e3cfa1','#2a4a66','#6b3a1f']
def arch(w, spring, top, floor):
    x0,x1=cx-w/2,cx+w/2; ry=spring-top
    return f"M{x0},{floor} L{x0},{spring} A{w/2},{ry} 0 0 1 {x1},{spring} L{x1},{floor} Z"
def archline(w, spring, top, floor):
    x0,x1=cx-w/2,cx+w/2; ry=spring-top
    return f"M{x0},{floor+60} L{x0},{spring} A{w/2},{ry} 0 0 1 {x1},{spring} L{x1},{floor+60}"
def books(x0,y0,x1,y1,rowh,pal,board,seed):
    r=random.Random(seed); out=[]; y=y0
    while y<y1:
        out.append(f'<rect x="{x0}" y="{y+rowh-rowh*0.09}" width="{x1-x0}" height="{rowh*0.09}" fill="{board}"/>')
        x=x0
        while x<x1:
            bw=rowh*r.uniform(0.11,0.22); bh=rowh*r.uniform(0.62,0.86); c=r.choice(pal)
            out.append(f'<rect x="{x:.1f}" y="{y+rowh*0.91-bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{c}"/>')
            if r.random()<.5: out.append(f'<rect x="{x:.1f}" y="{y+rowh*0.91-bh+bh*0.18:.1f}" width="{bw:.1f}" height="{max(1.5,bh*0.05):.1f}" fill="#e2c27a" opacity=".55"/>')
            x+=bw+rowh*0.012
        y+=rowh
    return '\n'.join(out)
A=[  # (Breite, Kämpfer, Scheitel, Boden, Bandbreite, Holz)
 (700,470,250,1024,46,'#a5652e'),
 (480,520,345,930,32,'#93582a'),
 (330,555,420,860,22,'#7f4b24'),
 (220,585,480,815,15,'#6d3f1e'),
]
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">',
'<defs>',
'<radialGradient id="glow" cx="50%" cy="72%" r="30%"><stop offset="0" stop-color="#ffe7b0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7b0" stop-opacity="0"/></radialGradient>',
'<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98a55"/><stop offset="1" stop-color="#e9c891"/></linearGradient>',
'<radialGradient id="vig" cx="50%" cy="55%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1a0c04" stop-opacity=".55"/></radialGradient>']
for i,(w,sp,tp,fl,b,_) in enumerate(A):
    svg.append(f'<clipPath id="o{i}"><path d="{arch(w,sp,tp,fl)}"/></clipPath>')
svg.append('</defs>')
# Ebene 0: Wand mit Regalen
svg.append(f'<rect width="{S}" height="{S}" fill="#4a2a14"/>')
svg.append(books(0,-20,S,S,92,SPINES,'#5a3416',1))
svg.append(f'<rect width="{S}" height="{S}" fill="#1a0c04" opacity=".28"/>')
# Ebenen 1..n: jeweils innerhalb der vorherigen Öffnung
def layer(i):
    w,sp,tp,fl,b,wood=A[i]
    g=[f'<g clip-path="url(#o{i})">']
    if i+1<len(A):
        rowh=[64,46,32][i]
        g.append(f'<rect width="{S}" height="{S}" fill="#3e2310"/>')
        g.append(books(cx-w/2,tp-10,cx+w/2,fl,rowh,SPINES,'#4e2d14',10+i))
        nf=A[i+1][3]; g.append(f'<rect x="0" y="{fl- (fl-nf)}" width="{S}" height="{S}" fill="url(#floor)"/>')
    else:  # Rückwand: blaue Regale, Lesepult mit offenem Buch
        g.append(f'<rect width="{S}" height="{S}" fill="#24394f"/>')
        g.append(books(cx-w/2,tp,cx+w/2,fl,24,BACK,'#3a2614',99))
        g.append(f'<rect x="0" y="{fl-40}" width="{S}" height="80" fill="url(#floor)"/>')
        g.append(f'<rect width="{S}" height="{S}" fill="url(#glow)"/>')
        lx=cx; ly=fl-58
        g.append(f'<rect x="{lx-46}" y="{ly}" width="92" height="56" fill="#3a2010"/>')
        g.append(f'<rect x="{lx-52}" y="{ly-6}" width="104" height="8" fill="#5a3416"/>')
        g.append(f'<path d="M{lx-46},{ly-8} Q{lx-24},{ly-30} {lx},{ly-14} Q{lx+24},{ly-30} {lx+46},{ly-8} L{lx+46},{ly-4} Q{lx+24},{ly-24} {lx},{ly-9} Q{lx-24},{ly-24} {lx-46},{ly-4} Z" fill="#fff4dc"/>')
        g.append(f'<path d="M{lx},{ly-14} L{lx},{ly-9}" stroke="#c9a465" stroke-width="1.5"/>')
    g.append('</g>')
    # Holzbogen (Rahmen um diese Öffnung) – vor allem Inneren
    g.append(f'<path d="{archline(w,sp,tp,fl)}" fill="none" stroke="{wood}" stroke-width="{b}" stroke-linejoin="round"/>')
    g.append(f'<path d="{archline(w-b*1.05,sp,tp+b*0.52,fl)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="{b*0.16}"/>')
    g.append(f'<path d="{archline(w+b*1.0,sp,tp-b*0.5,fl)}" fill="none" stroke="#e0a868" stroke-opacity=".35" stroke-width="{b*0.12}"/>')
    return '\n'.join(g)
# von hinten nach vorn zeichnen, damit vordere Bögen innere überdecken
for i in range(len(A)):
    svg.append(layer(i))
svg.append(f'<rect width="{S}" height="{S}" fill="url(#vig)"/>')
svg.append('</svg>')
open('icon.svg','w').write('\n'.join(svg))
