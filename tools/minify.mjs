// Regenera styles/*.min.css e scripts/*.min.js a partir dos fontes.
// Rodar manualmente (`npm run minify`) depois de editar arquivos em styles/ ou scripts/.
// Não faz parte do deploy (GitHub Pages sobe os arquivos crus, incluindo os .min já commitados).
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { extname, join, basename } from 'node:path';

async function minifyDir(dir, ext, loader) {
  const files = readdirSync(dir).filter(
    f => extname(f) === ext && !f.endsWith(`.min${ext}`)
  );
  for (const file of files) {
    const src = join(dir, file);
    const out = join(dir, `${basename(file, ext)}.min${ext}`);
    await build({
      entryPoints: [src],
      outfile: out,
      minify: true,
      loader: { [ext]: loader },
      logLevel: 'warning',
    });
    console.log(`${src} -> ${out}`);
  }
}

await minifyDir('styles', '.css', 'css');
await minifyDir('scripts', '.js', 'js');
