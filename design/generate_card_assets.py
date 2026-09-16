"""Generate the GO DR*W YOURSELF card masters and PNG fallbacks.

The SVG and PNG files are generated from the same tokens and icon vocabulary.
Run with the bundled Codex Python runtime; Pillow is the only dependency.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import html

ROOT = Path(__file__).resolve().parents[1]
SVG_DIR = ROOT / "public/assets/cards/svg"
PNG_DIR = ROOT / "public/assets/cards/png"
OVERVIEW_DIR = ROOT / "public/assets/cards/overview"
W, H = 750, 1050

COLORS = {
    "red": (225, 54, 75),
    "blue": (42, 111, 224),
    "green": (36, 166, 112),
    "yellow": (245, 190, 49),
    "violet": (112, 71, 235),
}

BASIC = {
    "pass": ("PASS", "PLAY IT FORWARD", "pass"),
    "link": ("LINK", "HOLD THE LINE", "link"),
    "pulse": ("PULSE", "KEEP IT MOVING", "pulse"),
    "arc": ("ARC", "BEND THE FLOW", "arc"),
}
ACTION = {
    "shove": ("SHOVE", "PUSH THE TURN", "shove"),
    "target": ("TARGET", "CHOOSE WHO SITS OUT", "target"),
    "lowest": ("LOWEST", "SMALLEST HAND DRAWS 2", "lowest"),
    "ditch": ("DITCH", "DROP ONE EXTRA", "ditch"),
    "draw_2": ("DRAW 2", "MAKE THEM TAKE TWO", "draw2"),
    "draw_4": ("DRAW 4", "MAKE THEM TAKE FOUR", "draw4"),
    "skip": ("SKIP", "NEXT PLAYER SITS OUT", "skip"),
    "reverse": ("REVERSE", "FLIP THE DIRECTION", "reverse"),
    "drop_all": ("DROP ALL", "DUMP ONE COLOR", "dropall"),
}
CHAOS = {
    "swap": ("SWAP", "TRADE COMPLETE HANDS", "swap"),
    "rotate": ("ROTATE", "EVERY HAND MOVES", "rotate"),
    "skip_all": ("SKIP ALL", "EVERYONE ELSE SITS OUT", "skipall"),
    "wild_reverse_draw_4": ("REVERSE +4", "FLIP IT. THEY DRAW FOUR.", "reverse4"),
    "wild_draw_6": ("WILD DRAW 6", "CHOOSE. THEY DRAW SIX.", "draw6"),
    "wild_draw_10": ("WILD DRAW 10", "CHOOSE. THEY DRAW TEN.", "draw10"),
    "color_roulette": ("COLOR ROULETTE", "LET CHAOS CHOOSE", "roulette"),
}
# Read-only compatibility for cards persisted by the previous ruleset.
COMPAT = {
    "wild": ("WILD", "CHOOSE THE COLOR", "wild"),
    "wild_draw_4": ("WILD DRAW 4", "CHOOSE. THEY DRAW FOUR.", "draw4"),
    "draw_1": ("DRAW 1", "MAKE THEM TAKE ONE", "draw1"),
}

FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
FONT_REG = Path("C:/Windows/Fonts/arial.ttf")
FONT_BLACK = Path("C:/Windows/Fonts/ariblk.ttf")

def font(path, size):
    return ImageFont.truetype(str(path), size)

def blend(a, b, t):
    return tuple(round(x * (1-t) + y * t) for x, y in zip(a, b))

def gradient(size, top, bottom):
    im = Image.new("RGB", size)
    d = ImageDraw.Draw(im)
    for y in range(size[1]):
        d.line((0, y, size[0], y), fill=blend(top, bottom, y/max(1,size[1]-1)))
    return im

def multicolor_gradient(size, stops):
    im=Image.new("RGBA",size)
    d=ImageDraw.Draw(im); segments=len(stops)-1
    for x in range(size[0]):
        p=x/max(1,size[0]-1)*segments; i=min(int(p),segments-1); t=p-i
        d.line((x,0,x,size[1]),fill=(*blend(stops[i],stops[i+1],t),255))
    return im

def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0,0,size[0]-1,size[1]-1), radius, fill=255)
    return m

def center_text(draw, xy, text, fnt, fill, stroke=0, stroke_fill=None):
    box = draw.textbbox((0,0), text, font=fnt, stroke_width=stroke)
    draw.text((xy[0]-(box[2]-box[0])/2, xy[1]-(box[3]-box[1])/2), text,
              font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)

def draw_icon(draw, kind, cx, cy, color, scale=1.0):
    s = scale; white=(250,252,255); ink=(15,24,39)
    lw=max(8, int(22*s)); r=int(125*s)
    def line(points, fill=white, width=lw): draw.line(points, fill=fill, width=width, joint="curve")
    if kind == "pass":
        draw.polygon([(cx,cy-r),(cx+r,cy+r*.78),(cx-r,cy+r*.78)],fill=white)
    elif kind == "link":
        draw.rounded_rectangle((cx-r,cy-r,cx+r,cy+r),28*s,fill=white)
    elif kind == "pulse":
        draw.ellipse((cx-r,cy-r,cx+r,cy+r),fill=white)
    elif kind == "arc":
        draw.pieslice((cx-r,cy-r,cx+r,cy+r),180,360,fill=white)
    elif kind == "shove":
        draw.polygon([(cx,cy-r),(cx+r,cy),(cx,cy+r),(cx-r,cy)],fill=white)
    elif kind == "target":
        for rr in (r,r*.58,r*.18): draw.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=white,width=lw)
        line([(cx,cy-r-35*s),(cx,cy+r+35*s)]); line([(cx-r-35*s,cy),(cx+r+35*s,cy)])
        line([(cx+80*s,cy+105*s),(cx+175*s,cy+105*s)]); line([(cx+135*s,cy+65*s),(cx+180*s,cy+105*s),(cx+135*s,cy+145*s)])
    elif kind == "lowest":
        draw.ellipse((cx-145*s,cy-135*s,cx-45*s,cy-35*s),fill=white)
        draw.pieslice((cx-195*s,cy-45*s,cx+5*s,cy+155*s),180,360,fill=white)
        for off,ang in ((20,-8),(95,8)):
            draw.rounded_rectangle((cx+off*s,cy-55*s,cx+(off+95)*s,cy+90*s),14*s,outline=white,width=max(8,int(16*s)))
        center_text(draw,(cx+105*s,cy-130*s),"+2",font(FONT_BLACK,int(70*s)),white)
    elif kind == "ditch":
        draw.rounded_rectangle((cx-65*s,cy-155*s,cx+65*s,cy+15*s),18*s,fill=white)
        line([(cx,cy+45*s),(cx,cy+135*s)]); line([(cx-45*s,cy+90*s),(cx,cy+140*s),(cx+45*s,cy+90*s)])
        line([(cx-130*s,cy+190*s),(cx+130*s,cy+190*s)]); line([(cx-130*s,cy+190*s),(cx-100*s,cy+135*s)]); line([(cx+130*s,cy+190*s),(cx+100*s,cy+135*s)])
    elif kind.startswith("draw"):
        n=kind[4:];
        for off in (-55,0,55): draw.rounded_rectangle((cx-105*s+off*s,cy-35*s+off*s*.12,cx+55*s+off*s,cy+125*s+off*s*.12),20*s,fill=white,outline=ink,width=max(3,int(5*s)))
        center_text(draw,(cx,cy-130*s),"+"+n,font(FONT_BLACK,int(105*s)),white)
    elif kind == "skip" or kind == "skipall":
        draw.ellipse((cx-r,cy-r,cx+r,cy+r),outline=white,width=lw); line([(cx-r*.7,cy+r*.7),(cx+r*.7,cy-r*.7)])
        if kind=="skipall": center_text(draw,(cx,cy+r+72*s),"ALL",font(FONT_BOLD,int(42*s)),white)
    elif kind == "reverse":
        line([(cx-r,cy-65*s),(cx+r*.55,cy-65*s)]); line([(cx+r*.15,cy-120*s),(cx+r,cy-65*s),(cx+r*.15,cy-10*s)])
        line([(cx+r,cy+75*s),(cx-r*.55,cy+75*s)]); line([(cx-r*.15,cy+20*s),(cx-r,cy+75*s),(cx-r*.15,cy+130*s)])
    elif kind == "rotate":
        draw.arc((cx-r,cy-r,cx+r,cy+r),35,190,fill=white,width=lw); draw.arc((cx-r,cy-r,cx+r,cy+r),215,370,fill=white,width=lw)
        line([(cx-r*.8,cy-r*.55),(cx-r*1.05,cy-r*.05),(cx-r*.45,cy-r*.08)])
        line([(cx+r*.8,cy+r*.55),(cx+r*1.05,cy+r*.05),(cx+r*.45,cy+r*.08)])
        for px,py in ((cx,cy-62*s),(cx-68*s,cy+48*s),(cx+68*s,cy+48*s)): draw.rounded_rectangle((px-26*s,py-38*s,px+26*s,py+38*s),8*s,fill=ink,outline=white,width=max(5,int(8*s)))
    elif kind == "reverse4":
        line([(cx-r,cy-125*s),(cx+r*.55,cy-125*s)]); line([(cx+r*.15,cy-175*s),(cx+r,cy-125*s),(cx+r*.15,cy-75*s)])
        line([(cx+r,cy-30*s),(cx-r*.55,cy-30*s)]); line([(cx-r*.15,cy-80*s),(cx-r,cy-30*s),(cx-r*.15,cy+20*s)])
        center_text(draw,(cx,cy+80*s),"+4",font(FONT_BLACK,int(80*s)),white)
        for off in (-50,35): draw.rounded_rectangle((cx-70*s+off*s,cy+145*s,cx+10*s+off*s,cy+255*s),12*s,outline=white,width=max(6,int(12*s)))
    elif kind == "dropall":
        for i in range(4): draw.rounded_rectangle((cx-125*s+i*42*s,cy-120*s+i*25*s,cx+20*s+i*42*s,cy+80*s+i*25*s),18*s,outline=white,width=max(5,int(9*s)))
        line([(cx,cy+155*s),(cx,cy+230*s)]); line([(cx-45*s,cy+190*s),(cx,cy+235*s),(cx+45*s,cy+190*s)])
    elif kind == "swap":
        draw.rounded_rectangle((cx-165*s,cy-75*s,cx-65*s,cy+85*s),16*s,fill=white)
        draw.rounded_rectangle((cx+65*s,cy-75*s,cx+165*s,cy+85*s),16*s,fill=white)
        line([(cx-45*s,cy-85*s),(cx+45*s,cy-85*s)]); line([(cx+15*s,cy-120*s),(cx+55*s,cy-85*s),(cx+15*s,cy-50*s)])
        line([(cx+45*s,cy+100*s),(cx-45*s,cy+100*s)]); line([(cx-15*s,cy+65*s),(cx-55*s,cy+100*s),(cx-15*s,cy+135*s)])
    elif kind == "roulette":
        palette=[COLORS[k] for k in COLORS]
        for i,c in enumerate(palette): draw.pieslice((cx-r,cy-r,cx+r,cy+r),i*72,(i+1)*72,fill=c)
        draw.ellipse((cx-r,cy-r,cx+r,cy+r),outline=white,width=lw); draw.ellipse((cx-48*s,cy-48*s,cx+48*s,cy+48*s),fill=ink,outline=white,width=5)
        center_text(draw,(cx,cy-4*s),"?",font(FONT_BLACK,int(70*s)),white)
    elif kind == "wild":
        palette=[COLORS[k] for k in COLORS]
        for i,c in enumerate(palette): draw.polygon([(cx,cy),(cx+r,cy-r+i*(2*r/5)),(cx+r,cy-r+(i+1)*(2*r/5))],fill=c)
        draw.ellipse((cx-r,cy-r,cx+r,cy+r),outline=white,width=lw)

def esc(s): return html.escape(s)

def svg_icon(kind, chaos=False):
    # The icon master uses a compact universal symbol vocabulary. Text glyphs
    # are restricted to numerals; all directional marks are vector paths.
    stroke="#F8FBFF"; sw=22
    if kind=="pass": return '<path d="M375 315L535 620H215Z" fill="#F8FBFF"/>'
    if kind=="link": return '<rect x="235" y="335" width="280" height="280" rx="30" fill="#F8FBFF"/>'
    if kind=="pulse": return '<circle cx="375" cy="475" r="145" fill="#F8FBFF"/>'
    if kind=="arc": return '<path d="M215 535a160 160 0 0 1 320 0Z" fill="#F8FBFF"/>'
    if kind=="shove": return '<path d="M375 300l175 175-175 175-175-175Z" fill="#F8FBFF"/>'
    if kind=="target": return f'<g fill="none" stroke="{stroke}" stroke-width="{sw}"><circle cx="345" cy="455" r="125"/><circle cx="345" cy="455" r="55"/><path d="M345 290v330M180 455h330M455 565h105l-48-48m48 48-48 48"/></g>'
    if kind in ("skip","skipall"): return f'<g fill="none" stroke="{stroke}" stroke-width="{sw}"><circle cx="375" cy="475" r="125"/><path d="M287 563l176-176"/></g>' + (f'<text x="375" y="680" text-anchor="middle" class="mini">ALL</text>' if kind=="skipall" else '')
    if kind=="reverse": return f'<g fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M220 395h300l-65-60m65 60-65 60M530 550H230l65-60m-65 60 65 60"/></g>'
    if kind=="rotate": return f'<g stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"><path d="M375 315a160 160 0 1 1-145 90v-75m0 75h75" fill="none"/><g fill="{stroke}" stroke="none"><rect x="335" y="390" width="80" height="112" rx="12"/><rect x="245" y="505" width="80" height="112" rx="12"/><rect x="425" y="505" width="80" height="112" rx="12"/></g></g>'
    if kind=="reverse4": return f'<g fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M225 335h300l-65-55m65 55-65 55M525 455H225l65-55m-65 55 65 55"/></g><text x="375" y="590" text-anchor="middle" class="number">+4</text><g fill="none" stroke="{stroke}" stroke-width="16"><rect x="300" y="620" width="92" height="125" rx="13"/><rect x="370" y="600" width="92" height="125" rx="13"/></g>'
    if kind=="swap": return f'<g fill="{stroke}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"><rect x="205" y="390" width="105" height="155" rx="15"/><rect x="440" y="390" width="105" height="155" rx="15"/><path d="M330 365h95l-35-32m35 32-35 32M420 570h-95l35-32m-35 32 35 32" fill="none"/></g>'
    if kind=="lowest": return f'<g fill="{stroke}"><circle cx="285" cy="390" r="55"/><path d="M190 560q95-145 190 0Z"/></g><g fill="none" stroke="{stroke}" stroke-width="18"><rect x="405" y="415" width="90" height="135" rx="14" transform="rotate(-8 450 482)"/><rect x="470" y="390" width="90" height="135" rx="14" transform="rotate(8 515 457)"/></g><text x="505" y="350" text-anchor="middle" class="number">+2</text>'
    if kind=="ditch": return f'<g fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"><rect x="320" y="300" width="110" height="155" rx="15" fill="{stroke}"/><path d="M375 480v105m-55-52 55 55 55-55M240 665h270l-35-75m-200 0-35 75"/></g>'
    if kind=="roulette": return '''<g stroke="#F8FBFF" stroke-width="10" stroke-linejoin="round"><path d="M375 475V315a160 160 0 0 1 152 111Z" fill="#E1364B"/><path d="M375 475l152-49a160 160 0 0 1-58 178Z" fill="#F5BE31"/><path d="M375 475l94 129a160 160 0 0 1-188 0Z" fill="#24A670"/><path d="M375 475l-94 129a160 160 0 0 1-58-178Z" fill="#2A6FE0"/><path d="M375 475l-152-49a160 160 0 0 1 152-111Z" fill="#7047EB"/><circle cx="375" cy="475" r="55" fill="#10131B"/></g><text x="375" y="503" text-anchor="middle" class="number">?</text>'''
    symbols={"draw1":"▱  +1","draw2":"▱▱  +2","draw4":"▱▱  +4","draw6":"▱▱  +6","draw10":"▱▱  +10","dropall":"▱▱▱  ↓","roulette":"◉","wild":"◆"}
    return f'<text x="375" y="535" text-anchor="middle" class="icon">{esc(symbols.get(kind,"◆"))}</text>'

def make_svg(slug, title, subtitle, kind, rgb, family):
    chaos=family=="chaos"; action=family=="action"
    c="#%02X%02X%02X"%rgb
    top="#151923" if chaos else c
    bottom="#080B12" if chaos else "#101827"
    border="url(#holo)" if (chaos or action) else "rgba(255,255,255,.72)"
    name_size=44 if len(title)>12 else (50 if len(title)>9 else 58)
    basic=family=="basic"
    visible_copy="" if basic else f'''<text x="78" y="100" class="brand">GO DR*W YOURSELF</text><text x="672" y="100" text-anchor="end" class="family">{family.upper()}</text>
{svg_icon(kind,chaos)}
<text x="375" y="810" text-anchor="middle" class="name">{esc(title)}</text><text x="375" y="858" text-anchor="middle" class="sub">{esc(subtitle)}</text>
<rect x="92" y="910" width="566" height="2" fill="#fff" opacity=".28"/><text x="375" y="960" text-anchor="middle" class="family">SWAP IT · STACK IT · PASS IT ON</text>'''
    if basic: visible_copy=svg_icon(kind,chaos)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050" role="img" aria-labelledby="t d">
<title id="t">{esc(title)}</title><desc id="d">{esc(subtitle)}</desc><defs>
<linearGradient id="body" x2="0" y2="1"><stop stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>
<linearGradient id="holo"><stop stop-color="#51D7FF"/><stop offset=".25" stop-color="#7047EB"/><stop offset=".5" stop-color="#FF477E"/><stop offset=".75" stop-color="#FFD75A"/><stop offset="1" stop-color="#61F2A9"/></linearGradient>
<radialGradient id="glow"><stop stop-color="{c}" stop-opacity=".42"/><stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>
<filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="15" flood-opacity=".35"/></filter>
<style>.brand,.family,.name,.sub,.icon,.number,.mini{{font-family:Arial,sans-serif;fill:#F8FBFF}}.brand{{font-size:23px;font-weight:800;letter-spacing:2px}}.family{{font-size:16px;font-weight:700;letter-spacing:4px}}.name{{font-size:{name_size}px;font-weight:900;letter-spacing:1px}}.sub{{font-size:22px;font-weight:600;letter-spacing:1.5px}}.icon{{font-size:180px;font-weight:900}}.number{{font-size:76px;font-weight:900}}.mini{{font-size:38px;font-weight:800}}</style></defs>
<rect x="18" y="18" width="714" height="1014" rx="72" fill="url(#body)" filter="url(#shadow)"/>
<rect x="31" y="31" width="688" height="988" rx="61" fill="none" stroke="{border}" stroke-width="{8 if chaos else 6}"/>
<circle cx="375" cy="475" r="285" fill="url(#glow)"/>
{visible_copy}</svg>'''

def make_png(title, subtitle, kind, rgb, family):
    chaos=family=="chaos"; action=family=="action"
    top=(21,25,35) if chaos else rgb; bottom=(8,11,18) if chaos else (16,24,39)
    body=gradient((W,H),top,bottom).convert("RGBA"); body.putalpha(rounded_mask((W,H),72))
    canvas=Image.new("RGBA",(W,H),(0,0,0,0)); canvas.alpha_composite(body)
    d=ImageDraw.Draw(canvas)
    if chaos or action:
        holo=[(81,215,255),(112,71,235),(255,71,126),(255,215,90),(97,242,169)]
        ring_outer=Image.new("L",(W,H),0); ImageDraw.Draw(ring_outer).rounded_rectangle((25,25,W-25,H-25),64,fill=255)
        ring_inner=Image.new("L",(W,H),0); ImageDraw.Draw(ring_inner).rounded_rectangle((34,34,W-34,H-34),56,fill=255)
        ring=ImageChops.subtract(ring_outer,ring_inner)
        holo_layer=multicolor_gradient((W,H),holo)
        canvas.paste(holo_layer,(0,0),ring); d=ImageDraw.Draw(canvas)
    else: d.rounded_rectangle((30,30,W-30,H-30),62,outline=(255,255,255,185),width=6)
    glow=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow); gd.ellipse((110,210,640,740),fill=(*rgb,80)); glow=glow.filter(ImageFilter.GaussianBlur(70)); canvas.alpha_composite(glow); d=ImageDraw.Draw(canvas)
    draw_icon(d,kind,375,475,rgb,1.0)
    if family=="basic": return canvas
    d.text((78,70),"GO DR*W YOURSELF",font=font(FONT_BOLD,23),fill=(248,251,255));
    fam=family.upper(); bb=d.textbbox((0,0),fam,font=font(FONT_BOLD,16)); d.text((672-(bb[2]-bb[0]),76),fam,font=font(FONT_BOLD,16),fill=(225,232,245))
    name_size=42 if len(title)>12 else (48 if len(title)>9 else 56)
    center_text(d,(375,790),title,font(FONT_BLACK,name_size),(248,251,255)); center_text(d,(375,850),subtitle,font(FONT_BOLD,21),(230,236,246))
    d.line((92,910,658,910),fill=(255,255,255,70),width=2); center_text(d,(375,955),"SWAP IT · STACK IT · PASS IT ON",font(FONT_BOLD,15),(210,220,234))
    return canvas

def write_card(filename, title, subtitle, kind, rgb, family):
    (SVG_DIR/f"{filename}.svg").write_text(make_svg(filename,title,subtitle,kind,rgb,family),encoding="utf-8")
    make_png(title,subtitle,kind,rgb,family).save(PNG_DIR/f"{filename}.png",optimize=True)

def main():
    for p in (SVG_DIR,PNG_DIR,OVERVIEW_DIR): p.mkdir(parents=True,exist_ok=True)
    for color,rgb in COLORS.items():
        for slug,(title,sub,kind) in BASIC.items(): write_card(f"gdy_{color}_{slug}",title,sub,kind,rgb,"basic")
        for slug,(title,sub,kind) in ACTION.items(): write_card(f"gdy_{color}_{slug}",title,sub,kind,rgb,"action")
        title,sub,kind=COMPAT["draw_1"]; write_card(f"gdy_{color}_draw_1",title,sub,kind,rgb,"action")
    chaos_rgb=(112,71,235)
    for slug,(title,sub,kind) in CHAOS.items(): write_card(f"gdy_black_{slug}",title,sub,kind,chaos_rgb,"chaos")
    for slug in ("wild","wild_draw_4"):
        title,sub,kind=COMPAT[slug]; write_card(f"gdy_black_{slug}",title,sub,kind,chaos_rgb,"chaos")
    # Card back uses the same premium system.
    write_card("gdy_card_back","GO DR*W","YOURSELF","roulette",(112,71,235),"chaos")

    picks=[("red","pass","basic"),("blue","link","basic"),("green","pulse","basic"),("yellow","arc","basic"),
           ("violet","shove","action"),("red","target","action"),("blue","lowest","action"),("green","ditch","action"),
           ("yellow","draw_2","action"),("violet","draw_4","action"),("red","skip","action"),("blue","reverse","action"),("green","drop_all","action")]
    picks += [("black",s,"chaos") for s in CHAOS]
    poster=gradient((2400,1700),(239,245,252),(205,218,235)).convert("RGB"); pd=ImageDraw.Draw(poster)
    pd.text((90,62),"GO DR*W YOURSELF",font=font(FONT_BLACK,70),fill=(13,24,39)); pd.text((92,145),"CARD SYSTEM · FIVE COLORS · THREE FAMILIES",font=font(FONT_BOLD,28),fill=(58,76,99))
    for idx,(color,slug,fam) in enumerate(picks):
        row=idx//7; col=idx%7; x=75+col*330; y=250+row*470
        path=PNG_DIR/f"gdy_{color}_{slug}.png"; card=Image.open(path).convert("RGBA"); card.thumbnail((285,399),Image.Resampling.LANCZOS); poster.paste(card,(x,y),card)
    poster.save(OVERVIEW_DIR/"gdy_card_system_overview.png",optimize=True)
    # SVG overview references final masters so it remains small and editable.
    uses=[]
    for idx,(color,slug,fam) in enumerate(picks):
        x=75+(idx%7)*330; y=250+(idx//7)*470
        uses.append(f'<image href="../svg/gdy_{color}_{slug}.svg" x="{x}" y="{y}" width="285" height="399"/>')
    (OVERVIEW_DIR/"gdy_card_system_overview.svg").write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1700" viewBox="0 0 2400 1700"><rect width="2400" height="1700" fill="#E8F0F8"/><text x="90" y="125" font-family="Arial" font-weight="900" font-size="70" fill="#0D1827">GO DR*W YOURSELF</text><text x="92" y="185" font-family="Arial" font-weight="700" font-size="28" fill="#3A4C63">CARD SYSTEM · FIVE COLORS · THREE FAMILIES</text>{''.join(uses)}</svg>''',encoding="utf-8")

if __name__=="__main__": main()
