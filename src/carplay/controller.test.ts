import assert from 'node:assert/strict';
import test from 'node:test';
import { activityProps, createActivityController, type ActivityFactory, type ActivityHandle, type MeterActivityInput } from './controller';

const running: MeterActivityInput = { status: 'running', fare: 4800, distanceMeters: 0, elapsedSeconds: 0 };
function fixture(old: ActivityHandle[] = []) {
  const calls: string[] = [];
  const handle: ActivityHandle = {
    async update(props) { calls.push(`update:${props.status}`); },
    async end() { calls.push('end'); },
  };
  const factory: ActivityFactory = {
    getInstances: () => old,
    start(props) { calls.push(`start:${props.status}`); return handle; },
  };
  return { calls, factory, handle };
}

test('cleans up old activities before starting and ends on finish', async () => {
  const f = fixture();
  f.factory.getInstances = () => [{ ...f.handle, async end() { f.calls.push('old:end'); } }];
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, true);
  await controller.sync({ ...running, status: 'finished' }, true, true);
  assert.deepEqual(f.calls, ['old:end', 'start:주행 중 · 요금', 'end']);
});

test('background and paused trips never create activities', async () => {
  const f = fixture();
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, false);
  await controller.sync({ ...running, status: 'paused' }, true, true);
  await controller.sync(running, false, true);
  assert.deepEqual(f.calls, []);
});

test('background transitions publish pause; identical seconds do not update', async () => {
  const f = fixture();
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, true);
  await controller.sync({ ...running, elapsedSeconds: 1 }, true, true);
  await controller.sync(running, true, false);
  await controller.sync(running, true, true);
  await controller.dispose();
  assert.deepEqual(f.calls, ['start:주행 중 · 요금', 'update:일시정지 · 요금', 'update:주행 중 · 요금', 'end']);
});

test('finish supersedes a queued start during startup cleanup', async () => {
  let release!: () => void;
  const f = fixture([{ async update() {}, end: () => new Promise<void>(resolve => { release = resolve; }) }]);
  const controller = createActivityController(f.factory, () => {});
  const start = controller.sync(running, true, true);
  await Promise.resolve();
  const finish = controller.sync({ ...running, status: 'finished' }, true, true);
  release();
  await Promise.all([start, finish]);
  assert.deepEqual(f.calls, []);
});

test('end waits for pending native update and does not overlap it', async () => {
  const f = fixture();
  let release!: () => void;
  f.handle.update = () => new Promise<void>(resolve => { f.calls.push('update:pending'); release = resolve; });
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, true);
  const update = controller.sync({ ...running, fare: 4900 }, true, true);
  await Promise.resolve();
  await Promise.resolve();
  const end = controller.sync(running, false, true);
  assert.equal(f.calls.includes('end'), false);
  release();
  await Promise.all([update, end]);
  assert.equal(f.calls.at(-1), 'end');
});

test('native errors are reported without rejecting and allow later cleanup', async () => {
  const f = fixture();
  const results: string[] = [];
  f.factory.start = () => { throw new Error('Activities disabled'); };
  const controller = createActivityController(f.factory, result => results.push(result.status));
  await controller.sync(running, true, true);
  await controller.dispose();
  assert.deepEqual(results, ['error']);
});

test('formatted props contain static duration instead of a running timer', () => {
  assert.deepEqual(activityProps({ ...running, elapsedSeconds: 125, distanceMeters: 1520 }, false), {
    fare: '4,800원', distance: '1.5 km', duration: '2분', status: '일시정지 · 요금',
  });
});

test('failed start is suppressed across timer and fare changes until pause/resume', async () => {
  const f = fixture();
  let attempts = 0;
  const start = f.factory.start;
  f.factory.start = (...args) => {
    attempts++;
    if (attempts === 1) throw new Error('disabled');
    return start(...args);
  };
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, true);
  await controller.sync({ ...running, elapsedSeconds: 1 }, true, true);
  await controller.sync({ ...running, elapsedSeconds: 61, fare: 4900 }, true, true);
  assert.equal(attempts, 1);
  await controller.sync({ ...running, status: 'paused' }, true, true);
  await controller.sync(running, true, true);
  assert.equal(attempts, 2);
});

test('failed update is suppressed until lifecycle change and disabled cleanup still runs', async () => {
  const f = fixture();
  let attempts = 0;
  f.handle.update = async () => { attempts++; throw new Error('update failed'); };
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, true);
  await controller.sync({ ...running, fare: 4900 }, true, true);
  await controller.sync({ ...running, fare: 5000, elapsedSeconds: 60 }, true, true);
  assert.equal(attempts, 1);
  await controller.sync({ ...running, status: 'paused' }, true, true);
  assert.equal(attempts, 2);
  await controller.sync(running, false, true);
  assert.equal(f.calls.at(-1), 'end');
});

test('new trip permits recovery even when intervening lifecycle requests are coalesced', async () => {
  const f = fixture();
  let attempts = 0;
  const start = f.factory.start;
  f.factory.start = (...args) => {
    attempts++;
    if (attempts === 1) throw new Error('start failed');
    return start(...args);
  };
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, true);
  const idle = controller.sync({ ...running, status: 'idle' }, true, true);
  const newTrip = controller.sync(running, true, true);
  await Promise.all([idle, newTrip]);
  assert.equal(attempts, 2);
});

test('connected CarPlay does not start ActivityKit from background', async () => {
  const f = fixture();
  const controller = createActivityController(f.factory, () => {});
  await controller.sync(running, true, false, true);
  assert.deepEqual(f.calls, []);
  await controller.sync(running, true, true, true);
  await controller.sync({ ...running, fare: 4900 }, true, false, true);
  assert.deepEqual(f.calls, ['start:주행 중 · 요금', 'update:주행 중 · 요금']);
});

test('ordinary driving activity displays distance without taxi fare', () => {
  const props = activityProps({ ...running, mode: 'log', fare: 4800, distanceMeters: 1234 }, true);
  assert.equal(props.fare, '1.2 km');
  assert.equal(props.status, '주행 중 · 운행 기록');
  assert.equal(JSON.stringify(props).includes('원'), false);
});
