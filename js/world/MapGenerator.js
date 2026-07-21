/**
 * MapGenerator.js
 * ---------------------------------------------------------------------------
 * Produces a fresh random arena each match. Design goals:
 *   - Solid border and a regular pillar lattice for structure.
 *   - Random destructible crystals filling the open space.
 *   - Guaranteed clear spawn pockets in each corner for every faction.
 *   - A few linked teleport-pad pairs for mobility and surprise.
 *
 * Returns spawn points (world coordinates) alongside the populated Grid.
 * ---------------------------------------------------------------------------
 */
import { TILE } from '../core/constants.js';
import { CRYSTAL_CFG } from '../core/constants.js';
import { chance, randInt, shuffle } from '../core/utils.js';
import { Grid } from './Grid.js';

export class MapGenerator {
  /** Generate a grid + spawn points for `factionCount` players. */
  static generate(factionCount, theme) {
    const grid = new Grid(theme);
    const { cols, rows } = grid;

    // 1. Fill: border walls + interior pillar lattice on even/even tiles.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const border = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
        const pillar = c % 2 === 0 && r % 2 === 0;
        grid.set(c, r, border || pillar ? TILE.WALL : TILE.FLOOR);
      }
    }

    // 2. Corner spawn pockets kept clear (3x3 L-shaped safe zones).
    const corners = [
      { c: 1, r: 1, dc: 1, dr: 1 },
      { c: cols - 2, r: 1, dc: -1, dr: 1 },
      { c: 1, r: rows - 2, dc: 1, dr: -1 },
      { c: cols - 2, r: rows - 2, dc: -1, dr: -1 },
    ].slice(0, factionCount);

    const isSafe = (c, r) =>
      corners.some(({ c: sc, r: sr, dc, dr }) => {
        // Clear the spawn tile and the two orthogonal exits.
        return (c === sc && r === sr) ||
          (c === sc + dc && r === sr) ||
          (c === sc && r === sr + dr) ||
          (c === sc + dc * 2 && r === sr) ||
          (c === sc && r === sr + dr * 2);
      });

    // 3. Scatter destructible crystals across eligible floor tiles.
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (grid.get(c, r) !== TILE.FLOOR) continue;
        if (isSafe(c, r)) continue;
        if (chance(CRYSTAL_CFG.SCATTER_CHANCE)) grid.set(c, r, TILE.CRYSTAL);
      }
    }

    // 4. Place linked teleport pad pairs on open floor tiles.
    const openFloors = [];
    for (let r = 2; r < rows - 2; r++)
      for (let c = 2; c < cols - 2; c++)
        if (grid.get(c, r) === TILE.FLOOR && !isSafe(c, r)) openFloors.push({ c, r });
    shuffle(openFloors);

    const pairCount = Math.min(2, Math.floor(openFloors.length / 8));
    for (let i = 0; i < pairCount; i++) {
      const a = openFloors.pop();
      const b = openFloors.pop();
      if (!a || !b) break;
      grid.set(a.c, a.r, TILE.TELEPORT);
      grid.set(b.c, b.r, TILE.TELEPORT);
      grid.teleports.push({ c: a.c, r: a.r, linkIndex: i });
      grid.teleports.push({ c: b.c, r: b.r, linkIndex: i });
    }

    // 5. Compute world-space spawn points.
    const spawns = corners.map(({ c, r }) => grid.toWorld(c, r));

    return { grid, spawns };
  }
}
