# Third-Party Notices

This project adapts portions of the following open-source project.

## Tidewater

- **Project:** Tidewater — an island fishing game for the browser
- **Author:** Dan Greenheck / DRG Software Solutions LLC
- **Source:** https://github.com/dgreenheck/tidewater
- **What was adapted:** the fishing gameplay loop (charge-to-cast, habitat/depth and
  time-of-day bite scheduling, two-stage bite cues, line-tension fight in a green
  band, catch showcase) and the analytical multi-cascade wave evaluator. Adapted
  code lives mainly in `src/game/buddiesFishingMarket.ts`,
  `src/components/ShorelineCatchShowcaseModal.tsx`, and the shoreline fishing
  sections of `src/game/BuddiesBlitzArena.tsx`. Internal identifiers were renamed
  to this project's own "Shoreline" naming; the game design lineage is unchanged
  and is credited here as required by the license.
- **License:** MIT

```text
MIT License

Copyright (c) 2026 DRG Software Solutions LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
