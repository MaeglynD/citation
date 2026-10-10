"""Regenerate the README wordmark and lossless WOFF fonts: python + fontTools."""
from pathlib import Path
import json
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
fonts = ROOT / 'public/fonts'
out = ROOT / 'src/assets/fonts'
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

# Use the actual mystery portrait renderer, so the README stays in the game's style.
node = """
const fs = await import('node:fs'); const ts = await import('typescript');
const code = ts.transpileModule(fs.readFileSync('src/portraits/render.ts','utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {renderSilhouette}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
process.stdout.write(JSON.stringify([...renderSilhouette()]));
"""
pixels = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', node], cwd=ROOT))
silhouette = []
for y in range(48):
    for x in range(40):
        r, g, b, a = pixels[(y * 40 + x) * 4:(y * 40 + x) * 4 + 4]
        if a:
            color = '#20133c' if r + g + b < 90 else '#a5a1d5'
            silhouette.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{color}"/>')
qmark = ['.#####.', '##...##', '##...##', '....##.', '...##..', '..##...', '..##...', '.......', '..##...', '..##...']
question = ''.join(f'<rect x="{x}" y="{y}" width="1" height="1"/>' for y, row in enumerate(qmark) for x, c in enumerate(row) if c == '#')
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1008" height="372" viewBox="0 0 336 124" shape-rendering="crispEdges" role="img" aria-labelledby="title">',
       '<title id="title">Citation Needed!</title>',
       '<path fill="#493794" d="M3 0H333V3H336V121H333V124H3V121H0V3H3Z"/>',
       '<path fill="#20133c" d="M25 32H91V112H25Z"/>',
       '<path fill="#bdc8ff" d="M22 28H88V108H22Z"/>',
       '<path fill="#493794" d="M24 30H86V106H24Z"/>',
       '<path fill="#20133c" d="M27 33H83V103H27Z"/>',
       '<path fill="#6264b8" d="M28 34H82V102H28Z"/>']
svg.extend(f'<path stroke="#5053a3" d="M28 {y}H82"/>' for y in range(41, 103, 12))
svg += ['<path fill="#ffe35c" d="M29 35H32V38H29Z"/>',
        '<g transform="translate(28 35) scale(1.35)">' + ''.join(silhouette) + '</g>',
        '<path fill="#20133c" d="M71 16H97V41H88L78 51V41H71Z"/>',
        '<path fill="#fff4dd" d="M69 14H95V39H85L76 48V39H69Z"/>',
        '<path fill="#b99af2" d="M69 14H95V15H70V39H69Z"/>',
        '<g fill="#ff6aab" transform="translate(77 20)">' + question + '</g>']
for text, y, color in [('CITATION', 57, '#fff4dd'), ('NEEDED', 94, '#ffe35c')]:
    svg += [lettering(text, 113, y + 4, '#20133c'), lettering(text, 111, y, color)]
svg += ['</svg>']
(ROOT / 'md/assets/logo.svg').write_text('\n'.join(svg), encoding='utf-8')
print('Generated README logo and two lossless WOFF fonts.')
