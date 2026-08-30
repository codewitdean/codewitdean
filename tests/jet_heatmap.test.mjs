import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  buildSvg, 
  buildMonotonicKeyTimes, 
  selectTargets, 
  buildCells, 
  generateMockWeeks,
  buildTargetLockBrackets,
  buildProminentRailguns,
  buildExplosiveImpacts,
  buildGrid,
  buildMonthLabels,
  THEME
} from '../generate.mjs';

describe('TDD: Space Defender Arcade Jet Heatmap Engine', () => {

  describe('Strict Monotonic SMIL Timeline Builder', () => {
    it('should generate strictly ascending keyTimes and prevent duplicate float collapse', () => {
      const rawEvents = [
        { time: 0.12345, value: '0' },
        { time: 0.12346, value: '1' },
        { time: 0.45000, value: '0' },
        { time: 0.45000, value: '1' }
      ];
      const result = buildMonotonicKeyTimes(rawEvents);
      const times = result.keyTimes.split('; ').map(Number);
      
      for (let i = 1; i < times.length; i++) {
        assert.ok(times[i] > times[i - 1], `Non-monotonic keyTimes detected: ${times[i - 1]} >= ${times[i]}`);
      }
      assert.strictEqual(times[0], 0);
      assert.strictEqual(times[times.length - 1], 1);
    });
  });

  describe('Target Selection & Decoupled Combat Layer', () => {
    it('should NEVER target empty (count === 0 / level 0) cells in asymmetric heatmaps', () => {
      const asymmetricWeeks = Array.from({ length: 52 }, (_, col) => ({
        contributionDays: Array.from({ length: 7 }, (_, row) => {
          if (col >= 30) {
            return { contributionCount: (col % 5) + 3, color: THEME.palette[3], date: '2026-06-01' };
          }
          return { contributionCount: 0, color: THEME.palette[0], date: '2026-01-01' };
        })
      }));
      const cells = buildCells(asymmetricWeeks, 52);
      const targets = selectTargets(cells);

      assert.ok(targets.length > 0, 'Should find targets in active columns');
      for (const t of targets) {
        assert.ok(t.col >= 30, `Target was chosen in empty column ${t.col} (< 30)`);
        assert.ok(t.count > 0, `Target in col ${t.col} has 0 count`);
        assert.notStrictEqual(t.color, THEME.palette[0], `Target in col ${t.col} has level-0 empty color`);
      }
    });

    it('should prioritize highest contribution count nodes and maintain minimum 3-column spacing', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);

      assert.ok(targets.length >= 1 && targets.length <= 8, `Target count ${targets.length} out of bounds`);
      
      for (let i = 0; i < targets.length; i++) {
        assert.ok(targets[i].count > 0, `Target ${i} has non-positive count: ${targets[i].count}`);
        assert.notStrictEqual(targets[i].color, THEME.palette[0]);
        if (i > 0) {
          const diff = targets[i].col - targets[i - 1].col;
          assert.ok(diff >= 3, `Target spacing violation between col ${targets[i - 1].col} and ${targets[i].col} (diff: ${diff})`);
        }
      }
    });

    it('should return 0 targets for completely empty heatmaps (0 contributions) gracefully without error', () => {
      const emptyWeeks = Array.from({ length: 52 }, () => ({
        contributionDays: Array.from({ length: 7 }, () => ({ contributionCount: 0, color: THEME.palette[0], date: '2026-01-01' }))
      }));
      const cells = buildCells(emptyWeeks, 52);
      const targets = selectTargets(cells);
      assert.ok(Array.isArray(targets));
      assert.strictEqual(targets.length, 0, `Expected 0 targets for empty heatmap, got ${targets.length}`);

      const lockSvg = buildTargetLockBrackets(targets);
      const railgunSvg = buildProminentRailguns(targets);
      const impactSvg = buildExplosiveImpacts(targets);
      const gridSvg = buildGrid(cells, targets);

      assert.ok(lockSvg.includes('id="target-lock-brackets"'));
      assert.ok(railgunSvg.includes('id="world-space-railguns"'));
      assert.ok(impactSvg.includes('id="explosive-impacts"'));
      assert.ok(gridSvg.includes('<rect'));
    });

    it('should generate transient holographic lock brackets for each target', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const lockSvg = buildTargetLockBrackets(targets);
      
      assert.ok(lockSvg.includes('id="target-lock-brackets"'));
      assert.ok(lockSvg.includes('class="lock-bracket"'));
    });

    it('should generate world-space vertical railgun lances fired on arrival', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const railgunSvg = buildProminentRailguns(targets);
      
      assert.ok(railgunSvg.includes('id="world-space-railguns"'));
      assert.ok(railgunSvg.includes('class="railgun-lance"'));
      assert.ok(railgunSvg.includes('dur="18s"'));
    });

    it('should generate crisp 14px maximum shockwave detonations without visual grid occlusion', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const impactSvg = buildExplosiveImpacts(targets);
      
      assert.ok(impactSvg.includes('class="explosive-impact"'));
      assert.ok(impactSvg.includes('class="shockwave-primary"'));
      const rAnimateMatches = impactSvg.match(/<animate attributeName="r"[^>]+values="([^"]+)"/g) || [];
      assert.ok(rAnimateMatches.length > 0);
      for (const m of rAnimateMatches) {
        const valStr = m.match(/values="([^"]+)"/)[1];
        const radii = valStr.split(';').map(s => Number(s.trim()));
        for (const r of radii) {
          assert.ok(r <= 14, `Shockwave radius ${r} exceeds 14px`);
        }
      }
    });
  });

  describe('Arcade HUD Layout & Visual Structure', () => {
    it('should produce 1180x340 Arcade Space Defender canvas matching dark.svg aesthetics', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.endsWith('</svg>'));
      assert.ok(svg.includes('viewBox="0 0 1180 340"'));
      assert.ok(svg.includes('SCORE:'));
      assert.ok(svg.includes('LVL 42 · AIML ARCHITECT') || svg.includes('LVL 42 · FULL-STACK ARCHITECT'));
      assert.ok(svg.includes('COMBO:'));
      assert.ok(svg.includes('x14 SHIPPER'));
      assert.ok(svg.includes('SHIELDS: 100%'));
      assert.ok(svg.includes('id="boresight-reticle"'));
      assert.ok(svg.includes('id="target-lock-brackets"'));
      assert.ok(svg.includes('id="world-space-railguns"'));
    });

    it('should generate rolling month labels matching 52-week chronological window', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const monthSvg = buildMonthLabels(cells);
      assert.ok(monthSvg.includes('class="axis-label"'));
      const textMatches = monthSvg.match(/<text [^>]+>([^<]+)<\/text>/g) || [];
      assert.ok(textMatches.length >= 10 && textMatches.length <= 13);
    });
  });

  describe('Profile Terminal Monospace Alignment & Boundary Invariance', () => {
    it('should ensure all terminal bio rows in dark.svg and light.svg align values at exact 28-character column offset', async () => {
      const fs = await import('node:fs');
      for (const file of ['dark.svg', 'light.svg']) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const lineMatches = content.match(/<g clip-path="url\(#lc(?:[1-9]|1[0-8])\)">.*?<\/g>/g) || [];
        for (const g of lineMatches) {
          if (!g.includes('class="value"')) continue;
          const prefixMatch = g.match(/<text [^>]+>(.*?)<tspan [^>]*class="value"/);
          if (prefixMatch) {
            const rawPrefix = prefixMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
            assert.strictEqual(
              rawPrefix.length,
              28,
              `File ${file} line has prefix length ${rawPrefix.length} instead of 28: "${rawPrefix}"`
            );
          }
        }
      }
    });
  });
});
