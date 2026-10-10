import type { MeterStatus } from '../domain/meter';

export interface MeterActivityInput {
  mode?: 'log' | 'taxi';
  status: MeterStatus;
  fare: number;
  distanceMeters: number;
  elapsedSeconds: number;
}
export interface MeterActivityProps {
  fare: string;
  distance: string;
  duration: string;
  status: string;
}
export interface ActivityHandle {
  update(props: MeterActivityProps, staleDate?: Date): Promise<void>;
  end(policy: 'immediate'): Promise<void>;
}
export interface ActivityFactory {
  start(props: MeterActivityProps, url?: string, staleDate?: Date): ActivityHandle;
  getInstances(): ActivityHandle[];
}
export type ActivityStatus = 'inactive' | 'active' | 'paused' | 'error';
export interface ActivityResult { status: ActivityStatus; errorMessage?: string }

export function activityProps(input: MeterActivityInput, foreground: boolean): MeterActivityProps {
  const minutes = Math.floor(input.elapsedSeconds / 60);
  return {
    fare: input.mode === 'log' ? `${(input.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(input.fare).toLocaleString('ko-KR')}원`,
    distance: `${(input.distanceMeters / 1000).toFixed(1)} km`,
    duration: `${minutes}분`,
    status: `${input.status === 'running' && foreground ? '주행 중' : '일시정지'} · ${input.mode === 'log' ? '운행 기록' : '요금'}`,
  };
}

/** Serializes native work and coalesces obsolete requests before touching ActivityKit. */
export function createActivityController(factory: ActivityFactory, report: (result: ActivityResult) => void) {
  let queue = Promise.resolve();
  let revision = 0;
  let initialized = false;
  let current: ActivityHandle | undefined;
  let lastPayload = '';
  let lifecycle = '';
  let lifecycleVersion = 0;
  let failedLifecycleVersion: number | undefined;
  const staleDate = () => new Date(Date.now() + 120_000);
  const enqueue = (operation: (version: number) => Promise<void>, operationLifecycle?: number) => {
    const version = ++revision;
    queue = queue.then(() => operation(version)).catch(() => {
      failedLifecycleVersion = operationLifecycle;
      report({ status: 'error', errorMessage: '실시간 현황을 표시하지 못했어요. iPhone의 실시간 현황 설정을 확인해 주세요.' });
    });
    return queue;
  };
  const initialize = async () => {
    if (initialized) return;
    // A previous process may have left an activity displaying an obsolete trip.
    for (const old of factory.getInstances()) await old.end('immediate');
    initialized = true;
  };
  const end = async () => {
    if (current) {
      await current.end('immediate');
      current = undefined;
    }
    lastPayload = '';
  };
  return {
    sync(input: MeterActivityInput, enabled: boolean, foreground: boolean, carPlayConnected = false) {
      const measuring = foreground || carPlayConnected;
      const nextLifecycle = `${input.status}:${enabled}:${foreground}:${carPlayConnected}`;
      if (nextLifecycle !== lifecycle) {
        lifecycle = nextLifecycle;
        lifecycleVersion++;
      }
      const operationLifecycle = lifecycleVersion;
      return enqueue(async version => {
        // Fare/time/GPS ticks must not repeatedly retry a rejected native request.
        // A pause/resume, foreground transition, toggle, or new trip permits recovery.
        if (failedLifecycleVersion === operationLifecycle) return;
        await initialize();
        if (version !== revision) return;
        if (!enabled || input.status === 'idle' || input.status === 'finished') {
          await end();
          report({ status: 'inactive' });
          return;
        }
        const props = activityProps(input, measuring);
        const payload = JSON.stringify(props);
        if (!current) {
          // Never start an activity when the app is backgrounded or the trip is paused.
          if (!foreground || input.status !== 'running') return;
          current = factory.start(props, undefined, staleDate());
          lastPayload = payload;
        } else if (payload !== lastPayload) {
          await current.update(props, staleDate());
          lastPayload = payload;
        }
        report({ status: input.status === 'running' && measuring ? 'active' : 'paused' });
      }, operationLifecycle);
    },
    dispose() {
      return enqueue(async () => { await initialize(); await end(); });
    },
  };
}
