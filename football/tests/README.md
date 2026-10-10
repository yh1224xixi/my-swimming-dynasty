# Football regression checks

From the repository root, install the DOM test dependency and run:

```sh
npm install --no-save jsdom
node football/tests/regression.cjs
```

The suite uses the actual game scripts with an isolated in-memory save. It checks
goal/assist conservation, red-card credit, playing minutes, experience and rating
limits, national/club stat separation, teammate favor, annual deposit interest,
monthly totals, breakthrough costs, finished-season snapshots, league scorer
allocation, old-save migration, and event pause/save/reload/resume without duplicate
choice effects.

If jsdom is installed elsewhere, set `JSDOM_MODULE` to its absolute module path.
No production or browser saves are read or changed by this suite.
