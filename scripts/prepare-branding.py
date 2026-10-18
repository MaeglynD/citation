"""Regenerate the README wordmark and lossless WOFF fonts: python + fontTools.

Use --logo-only to refresh the artwork without rewriting the font assets.
"""
from pathlib import Path
import argparse
import json
import math
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--logo-only', action='store_true')
args = parser.parse_args()
fonts = ROOT / 'public/fonts'
out = ROOT / 'src/assets/fonts'
if not args.logo_only:
    out.mkdir(parents=True, exist_ok=True)
    for name in ['PressStart2P-Regular', 'VT323-Regular']:
        font = TTFont(fonts / (name + '.ttf'), recalcTimestamp=False)
        font.flavor = 'woff'  # Troika supports WOFF, but not WOFF2. Keep every glyph.
        font.save(out / (name + '.woff'))

font = TTFont(fonts / 'PressStart2P-Regular.ttf')
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
def lettering(text, x, y, color):
    scale = 24 / font['head'].unitsPerEm
    paths = []
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
        paths.append(pen.getCommands())
        x += glyph.width * scale
    return f'<path fill="{color}" d="{" ".join(paths)}"/>'

# Read the actual default palette, portrait and question-mark sprite.
node = """
const fs = await import('node:fs'); const ts = await import('typescript');
const load = async path => {
 const code = ts.transpileModule(fs.readFileSync(path,'utf8'),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const {renderPortrait,PW,PH}=await load('src/portraits/render.ts');
const {THEMES}=await load('src/themes/palettes.ts');
const specs=JSON.parse(fs.readFileSync('src/data/portraits.json','utf8'));
const pixels=renderPortrait(specs['Dr. Evil'],'idle');
// Match the small directional-light pass in portraits/textures.ts.
for(let y=0;y<PH;y++) for(let x=0;x<PW;x++) {
 const k=(y*PW+x)*4;
 if(!pixels[k+3]) continue;
 const rim=x>0 && pixels[k-1]===0 && y<PH*.7, shade=x>PW*.67 ? .92 : 1;
 pixels[k]=Math.min(255,Math.round(pixels[k]*shade+(rim ? 14 : 0)));
 pixels[k+1]=Math.min(255,Math.round(pixels[k+1]*shade+(rim ? 10 : 0)));
 pixels[k+2]=Math.min(255,Math.round(pixels[k+2]*shade+(rim ? 3 : x>PW*.67 ? 4 : 0)));
}
const source=ts.createSourceFile('Sprites.tsx',fs.readFileSync('src/scene/Sprites.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=source.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>d.name.getText(source)==='QMARK');
const qmark=declaration.initializer.elements.map(e=>e.text);
process.stdout.write(JSON.stringify({pixels:[...pixels],width:PW,height:PH,palette:THEMES[0].palette,qmark}));
"""
assets = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', node], cwd=ROOT))
p = assets['palette']


def pixel_paths(w, h, color_at):
    """Merge identical horizontal pixels into compact, crisp SVG paths."""
    colors = {}
    for y in range(h):
        x = 0
        while x < w:
            color = color_at(x, y)
            end = x + 1
            while end < w and color_at(end, y) == color:
                end += 1
            if color:
                colors.setdefault(color, []).append(f'M{x} {y}h{end-x}v1h{x-end}z')
            x = end
    return ''.join(f'<path fill="{c}" d="{"".join(runs)}"/>' for c, runs in colors.items())


def box(x, y, w, h, fill, stroke=None, radius=3, border=1, stripe=None, step=0):
    # PixelBox's rounded-distance test, sampled at virtual-pixel centres.
    def color_at(px, py):
        qx = abs(px + .5 - w / 2) - w / 2 + radius
        qy = abs(py + .5 - h / 2) - h / 2 + radius
        distance = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - radius
        if distance > 0:
            return None
        if stroke and distance >= -border:
            return stroke
        return stripe if stripe and (h - py) % step == 0 else fill
    return f'<g transform="translate({x} {y})">{pixel_paths(w, h, color_at)}</g>'


def surface(x, y, w, h, fill, edge, paper=False):
    # Match Surface's stepped shadow, lower edge and one-pixel catchlight.
    return ''.join([
        box(x + 1, y + 3, w + 2, h + 2, p['shadow'], radius=4),
        box(x, y + 2, w, h, edge, p['shadow']),
        box(x, y, w, h, fill, edge),
        f'<path fill="{"#ffffff" if paper else p["paper"]}" opacity="{.7 if paper else .28}" d="M{x+3} {y+1}h{w-6}v1H{x+3}z"/>',
        f'<path fill="{p["shadow"]}" opacity="{.12 if paper else .28}" d="M{x+w-3} {y+4}h1v{h-6}h-1z"/>',
    ])


def portrait_color(x, y):
    i = (y * assets['width'] + x) * 4
    r, g, b, a = assets['pixels'][i:i+4]
    return f'#{r:02x}{g:02x}{b:02x}' if a else None


portrait = pixel_paths(assets['width'], assets['height'], portrait_color)
portrait_shadow = pixel_paths(assets['width'], assets['height'], lambda x, y: '#10121b' if portrait_color(x, y) else None)
question = pixel_paths(len(assets['qmark'][0]), len(assets['qmark']), lambda x, y: p['mark'] if assets['qmark'][y][x] == '#' else None)

# Same 1.5x portrait scale and 28x23 question bubble as the desktop title scene.
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1008" height="372" viewBox="0 0 336 124" shape-rendering="crispEdges" role="img" aria-labelledby="title desc">',
       '<title id="title">Citation Needed!</title>',
       '<desc id="desc">Dr. Evil beside the Citation Needed wordmark, with the home-screen question bubble in the default Midnight theme.</desc>',
       f'<defs><radialGradient id="backdrop" cx="50%" cy="38%" r="75%"><stop stop-color="{p["bg2"]}"/><stop offset="1" stop-color="{p["bg"]}"/></radialGradient></defs>',
       '<path fill="url(#backdrop)" d="M3 0H333V3H336V121H333V124H3V121H0V3H3Z"/>',
       f'<path fill="{p["muted"]}" opacity=".12" d="M15 16h1v1h-1zM143 15h1v1h-1zM303 15h1v1h-1zM111 111h1v1h-1zM271 111h1v1h-1zM319 79h1v1h-1z"/>',
       surface(20, 28, 72, 84, p['card'], p['cardEdge']),
       box(24, 32, 64, 76, p['card'], p['shadow'], radius=1, stripe=p['cardLine'], step=12),
       f'<path fill="{p["accent"]}" opacity=".55" d="M26 34h3v3h-3z"/>',
       f'<g transform="translate(29 37) scale(1.5)" opacity=".45">{portrait_shadow}</g>',
       f'<g transform="translate(26 34) scale(1.5)">{portrait}</g>',
       surface(72, 10, 28, 23, p['paper'], p['boxEdge'], paper=True),
       f'<path fill="{p["paperEdge"]}" d="M75 32h10v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-2v-1h-1z"/>',
       f'<path fill="{p["paper"]}" d="M76 31h8v2h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v-1h-1z"/>',
       f'<g transform="translate(83 16)">{question}</g>']
for text, y, color in [('CITATION', 57, p['heading']), ('NEEDED', 94, p['accent'])]:
    svg += [lettering(text, 113, y + 4, p['shadow']), lettering(text, 111, y, color)]
svg += ['</svg>']
(ROOT / 'md/assets/logo.svg').write_text('\n'.join(svg), encoding='utf-8')
print('Generated README logo.' if args.logo_only else 'Generated README logo and two lossless WOFF fonts.')
