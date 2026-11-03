PowerPoint export checks
=======================

Run `node tests/pptx-export.cjs` with Playwright, JSZip, and Chrome available.
The test fulfills local URLs from repository files; no web server or real login is required.
On its first run it downloads the pinned html2canvas 1.4.1 library already used by the application.
Outputs and dependencies used for inspection stay in `.qa/`, which is ignored by Git.

Coverage: original-template export, unchanged-page XML, split placeholders, XML escaping,
hexagon overflow, description font reduction, Excel formulas, memorial image generation,
logistics image generation, and read-only team import with pending candidates excluded.

The source template is `assets/hive-template.pptx` (SHA-256
`d944bc5d99a753c425e1651875f1c2bfb513729ef45863e8866d7e022e6a35e9`).
Pages 1, 5, 6, 7, 10, and 11 must remain byte-identical inside the generated ZIP.
The older attachment's page 9 title is corrected only in the export, as approved by the owner.
New content uses the existing rectangle from page 12 as its containment area; images retain aspect ratio.
The short technical summary comes from the existing `gerarResumoTecnico()` function.

Calibri, Arial, and Times New Roman must be installed on the exporting computer;
the exporter checks availability instead of silently substituting fonts.
The memorial image renderer implements the formulas, styles, merged cells, print areas,
number formats, and conditional rule found in the two bundled Excel templates.
It rejects unsupported formulas and excess equipment/structures instead of omitting data.
Any future change to these Excel templates needs corresponding rendering verification.

Manual verification: open the generated `.qa/export-test.pptx` in PowerPoint, render all slides,
compare fixed pages with the original, and inspect changed pages for text fit and image containment.
