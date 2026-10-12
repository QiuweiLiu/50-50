const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const metricsPath = path.join(root, 'data', 'validation', 'challenge-metrics.json');
const geometrySource = html.match(/<script id="geometry">([\s\S]*?)<\/script>/)?.[1];
assert.ok(geometrySource, '未找到 geometry 脚本');

const context = vm.createContext({});
vm.runInContext(`${geometrySource}\nglobalThis.api={Geometry,ShapeGenerator};`, context);
const { Geometry: G, ShapeGenerator: S } = context.api;

const SAMPLE_COUNT = 1000;
const CONFIGS = [
  { round: 9, seed: 0x509009 },
  { round: 15, seed: 0x501515 },
  { round: 30, seed: 0x503030 },
  { round: 60, seed: 0x506060 },
];
const STRATEGIES = ['vertical', 'horizontal', 'randomAngle', 'bboxVertical', 'bboxHorizontal'];
const CONSERVATION_EPSILON = 1e-6;

// 与 geometry.cjs 相同的固定线性同余随机数，保证基线和复测可复现。
function createRng(initial) {
  let seed = initial >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

// 所有策略都使用 Geometry.split 的真实面积计算，不使用近似公式。
function strategyLine(strategy, poly, angleRng) {
  if (strategy === 'vertical') return [{ x: 500, y: 0 }, { x: 500, y: 800 }];
  if (strategy === 'horizontal') return [{ x: 0, y: 400 }, { x: 1000, y: 400 }];
  if (strategy === 'bboxVertical' || strategy === 'bboxHorizontal') {
    const xs = poly.map((point) => point.x);
    const ys = poly.map((point) => point.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return strategy === 'bboxVertical'
      ? [{ x: cx, y: 0 }, { x: cx, y: 800 }]
      : [{ x: 0, y: cy }, { x: 1000, y: cy }];
  }
  const angle = angleRng() * Math.PI * 2;
  const dx = Math.cos(angle) * 1000;
  const dy = Math.sin(angle) * 1000;
  return [{ x: 500 - dx, y: 400 - dy }, { x: 500 + dx, y: 400 + dy }];
}

function fixedSolution(poly) {
  // 有效凸图形被限制在逻辑画布内，因此二分 x=0..1000 一定能找到面积平分线。
  let lo = 0;
  let hi = 1000;
  const total = G.area(poly);
  for (let i = 0; i < 50; i += 1) {
    const x = (lo + hi) / 2;
    const leftArea = G.area(G.clip(poly, { x, y: 0 }, { x, y: 800 }, 1));
    if (leftArea / total < 0.5) lo = x;
    else hi = x;
  }
  const x = (lo + hi) / 2;
  return G.split(poly, { x, y: 0 }, { x, y: 800 });
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

function measureConfig({ round, seed }) {
  const shapeRng = createRng(seed);
  const angleRng = createRng((seed ^ 0xa5a5a5a5) >>> 0);
  const shapes = Array.from({ length: SAMPLE_COUNT }, () => S.generate(round, shapeRng));
  const difficulty = S.difficulty(round);
  const generator = {
    valid: 0,
    invalid: 0,
    vertices: {},
    conservationMaxAbs: 0,
    conservationFailures: 0,
    areaMin: Infinity,
    areaMax: -Infinity,
    fiftySolutionFailures: 0,
  };
  const strategyData = Object.fromEntries(STRATEGIES.map((strategy) => [strategy, {
    passed: 0,
    splitCount: 0,
    missed: 0,
    errors: [],
  }]));
  const tolerance = difficulty.tolerance;

  for (const poly of shapes) {
    const isValid = G.valid(poly);
    if (isValid) generator.valid += 1;
    else generator.invalid += 1;
    generator.vertices[poly.length] = (generator.vertices[poly.length] || 0) + 1;
    const total = G.area(poly);
    generator.areaMin = Math.min(generator.areaMin, total);
    generator.areaMax = Math.max(generator.areaMax, total);
    const solution = fixedSolution(poly);
    if (!solution || Math.abs(solution.percent - 50) > 1e-6) generator.fiftySolutionFailures += 1;

    for (const strategy of STRATEGIES) {
      const line = strategyLine(strategy, poly, strategy === 'randomAngle' ? angleRng : null);
      const left = G.area(G.clip(poly, line[0], line[1], 1));
      const right = G.area(G.clip(poly, line[0], line[1], -1));
      const conservationError = Math.abs(left + right - total);
      generator.conservationMaxAbs = Math.max(generator.conservationMaxAbs, conservationError);
      if (conservationError > CONSERVATION_EPSILON) generator.conservationFailures += 1;

      const data = strategyData[strategy];
      const cut = G.split(poly, line[0], line[1]);
      if (!cut) {
        data.missed += 1;
        continue;
      }
      data.splitCount += 1;
      data.errors.push(cut.error);
      if (cut.error <= tolerance) data.passed += 1;
    }
  }

  const strategies = {};
  for (const strategy of STRATEGIES) {
    const data = strategyData[strategy];
    strategies[strategy] = {
      passed: data.passed,
      splitCount: data.splitCount,
      missed: data.missed,
      passRate: data.passed / SAMPLE_COUNT,
      passRateAmongSplits: data.splitCount ? data.passed / data.splitCount : 0,
      errorMean: data.errors.reduce((sum, value) => sum + value, 0) / (data.errors.length || 1),
      errorP95: percentile(data.errors, 0.95),
      errorMax: data.errors.length ? Math.max(...data.errors) : null,
    };
  }
  return {
    round,
    seed,
    difficulty: { tolerance: difficulty.tolerance, seconds: difficulty.seconds },
    generator,
    strategies,
  };
}

function measureAll() {
  return { configs: CONFIGS.map(measureConfig) };
}

function flattenStrategies(result) {
  return CONFIGS.flatMap(({ round }) => STRATEGIES.map((strategy) => ({
    round,
    strategy,
    ...result.configs.find((config) => config.round === round).strategies[strategy],
  })));
}

function assertCurrent(result, metrics) {
  const acceptance = metrics.acceptance;
  assert.equal(result.configs.length, CONFIGS.length, '当前结果缺少回合配置');
  for (const config of result.configs) {
    assert.equal(config.generator.invalid, 0, `回合 ${config.round} 存在无效图形`);
    assert.equal(config.generator.fiftySolutionFailures, 0, `回合 ${config.round} 无法找到 50/50 平分线`);
    assert.equal(config.generator.conservationFailures, 0, `回合 ${config.round} 存在面积不守恒切割`);
    assert.ok(config.generator.conservationMaxAbs <= acceptance.maxConservationError, `回合 ${config.round} 面积守恒误差过大`);
    const vertices = Object.keys(config.generator.vertices).map(Number);
    assert.ok(vertices.every((count) => count >= acceptance.requiredVertexRange[0] && count <= acceptance.requiredVertexRange[1]), `回合 ${config.round} 顶点数不在 5–8 范围`);
    for (const strategy of STRATEGIES) {
      const data = config.strategies[strategy];
      assert.ok(data.passRate <= acceptance.maxPerConfigPassRate, `回合 ${config.round} 的${strategy}固定切法通过率 ${(data.passRate * 100).toFixed(1)}% 超过阈值`);
    }
  }

  const rows = flattenStrategies(result);
  for (const strategy of STRATEGIES) {
    const group = rows.filter((row) => row.strategy === strategy);
    const passed = group.reduce((sum, row) => sum + row.passed, 0);
    const attempts = group.reduce((sum, row) => sum + SAMPLE_COUNT, 0);
    const pooledRate = passed / attempts;
    assert.ok(pooledRate <= acceptance.maxPooledPassRate, `${strategy} 汇总通过率 ${(pooledRate * 100).toFixed(1)}% 超过阈值`);
  }
  const currentAverage = rows.reduce((sum, row) => sum + row.passRate, 0) / rows.length;
  const baselineRows = flattenStrategies(metrics.baseline);
  const baselineAverage = baselineRows.reduce((sum, row) => sum + row.passRate, 0) / baselineRows.length;
  assert.ok(currentAverage <= baselineAverage - acceptance.minimumBaselineGap, `固定策略平均通过率 ${(currentAverage * 100).toFixed(1)}% 未比基线 ${(baselineAverage * 100).toFixed(1)}% 至少低 ${acceptance.minimumBaselineGap * 100} 个百分点`);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
const current = measureAll();
if (process.argv.includes('--record-current')) {
  metrics.current = { recordedAt: new Date().toISOString(), ...current };
  fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log('已记录当前生成器结果；基线未覆盖。请随后运行 node tests/challenge.cjs 执行验收。');
} else {
  assert.ok(metrics.current, '尚未记录当前结果，请在生成器修改后先运行 node tests/challenge.cjs --record-current');
  assert.deepEqual(metrics.current.configs, current.configs, 'current 记录与当前 index.html 不一致，请重新运行 node tests/challenge.cjs --record-current');
  assertCurrent(current, metrics);
  const rows = flattenStrategies(current);
  const average = rows.reduce((sum, row) => sum + row.passRate, 0) / rows.length;
  console.log(`通过：${SAMPLE_COUNT * CONFIGS.length} 个固定种子图形；生成器有效性、5–8 顶点、面积守恒、50/50 平分线及固定策略反破解检查通过；固定策略平均通过率 ${(average * 100).toFixed(1)}%。`);
}
