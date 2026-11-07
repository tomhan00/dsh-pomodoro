window.__ModuleLoader__.load({
  id: '@local/dsh-pomodoro',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'pomodoro';
    const STORAGE_KEY = 'dsh-pomodoro/v1';
    const MINUTE = 60000;
    const LONG_BREAK_EVERY = 4;
    const RING_RADIUS = 20;
    const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

    /** Minutes per phase, kept fixed for v1 (25/5/15, long break every fourth focus round). */
    const MINUTES = { focus: 25, short: 5, long: 15 };
    const duration = (phase) => (MINUTES[phase] ?? MINUTES.focus) * MINUTE;

    /** @typedef {{ phase: 'focus' | 'short' | 'long', running: boolean, endsAt: number | null, remaining: number, completed: number }} Timer */

    const initialState = () => ({ phase: 'focus', running: false, endsAt: null, remaining: duration('focus'), completed: 0 });

    let audio = null;
    /** Lazily create the audio context from a user gesture so the chime is allowed to play. */
    const primeAudio = () => {
      try {
        const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
        if (audio == null && AudioCtor != null) audio = new AudioCtor();
        if (audio != null && audio.state === 'suspended') audio.resume();
      } catch (error) {
        console.warn('[pomodoro] audio unavailable', error);
      }
    };
    /** Two-tone chime marking the end of a phase. */
    const chime = () => {
      try {
        if (audio == null) return;
        const base = audio.currentTime;
        [0, 0.3].forEach((offset, index) => {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = 'sine';
          osc.frequency.value = index === 0 ? 880 : 660;
          gain.gain.setValueAtTime(0.0001, base + offset);
          gain.gain.exponentialRampToValueAtTime(0.2, base + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, base + offset + 0.24);
          osc.connect(gain);
          gain.connect(audio.destination);
          osc.start(base + offset);
          osc.stop(base + offset + 0.26);
        });
      } catch (error) {
        console.warn('[pomodoro] chime failed', error);
      }
    };

    /** Read the persisted timer, counting a phase that expired while the page was closed. */
    const readState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw == null) return initialState();
        const saved = JSON.parse(raw);
        if (saved == null || typeof saved !== 'object' || !(saved.phase in MINUTES)) return initialState();
        const state = {
          phase: saved.phase,
          running: saved.running === true,
          endsAt: typeof saved.endsAt === 'number' ? saved.endsAt : null,
          remaining: typeof saved.remaining === 'number' && saved.remaining > 0 ? saved.remaining : duration(saved.phase),
          completed: Number.isFinite(saved.completed) ? Math.max(0, Math.trunc(saved.completed)) : 0
        };
        if (state.running && state.endsAt != null && state.endsAt <= Date.now()) {
          const advanced = advance(state);
          return { ...advanced, running: false, endsAt: null, remaining: duration(advanced.phase) };
        }
        if (state.running && state.endsAt == null) state.running = false;
        return state;
      } catch (error) {
        console.warn('[pomodoro] cannot restore state', error);
        return initialState();
      }
    };

    /** The phase after `state` finishes: every fourth focus round earns a long break. */
    const advance = (state) => {
      if (state.phase !== 'focus') return { ...state, phase: 'focus', running: false, endsAt: null, remaining: duration('focus') };
      const completed = state.completed + 1;
      const next = completed % LONG_BREAK_EVERY === 0 ? 'long' : 'short';
      return { ...state, phase: next, completed, running: false, endsAt: null, remaining: duration(next) };
    };

    let state = readState();
    const listeners = new Set();

    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('[pomodoro] cannot persist state', error);
      }
    };
    const emit = () => {
      for (const listener of listeners) listener();
    };
    const commit = (next) => {
      state = next;
      persist();
      emit();
    };
    const subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    const start = () => {
      primeAudio();
      if (state.running) return;
      commit({ ...state, running: true, endsAt: Date.now() + state.remaining });
    };
    const pause = () => {
      if (!state.running) return;
      const remaining = Math.max(0, (state.endsAt ?? Date.now()) - Date.now());
      commit({ ...state, running: false, endsAt: null, remaining });
    };
    const toggle = () => (state.running ? pause() : start());
    const reset = () => commit({ ...state, running: false, endsAt: null, remaining: duration(state.phase) });
    const skip = () => commit(advance(state));

    const CSS = [
      '.dsh-pomodoro{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;box-sizing:border-box}',
      '.dsh-pomodoro__ring{flex:0 0 auto;display:block}',
      '.dsh-pomodoro__main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.dsh-pomodoro__phase{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dsh-pomodoro__time{font-size:22px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}',
      '.dsh-pomodoro__meta{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dsh-pomodoro__dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary)}',
      '.dsh-pomodoro__actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}',
      '.dsh-pomodoro__btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 12px;font-size:12px;line-height:1.4;cursor:pointer}',
      '.dsh-pomodoro__btn:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.dsh-pomodoro__btn--primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}'
    ].join('');

    /** Ring + remaining time + controls for the shared singleton timer. */
    const Pomodoro = (props) => {
      const t = props.t;
      const [, setVersion] = React.useState(0);
      React.useEffect(() => subscribe(() => setVersion((value) => value + 1)), []);

      const total = duration(state.phase);
      const left = Math.max(0, state.running && state.endsAt != null ? state.endsAt - Date.now() : state.remaining);
      const seconds = Math.ceil(left / 1000);
      const text = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      const progress = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 0;
      const accent = state.phase === 'focus' ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-state-success-primary)';

      return h('div', { className: 'dsh-pomodoro', role: 'group', 'aria-label': t('title') },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h('svg', { className: 'dsh-pomodoro__ring', width: 48, height: 48, viewBox: '0 0 48 48', 'aria-hidden': 'true' },
          h('circle', { cx: 24, cy: 24, r: RING_RADIUS, fill: 'none', stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 3 }),
          h('circle', {
            cx: 24, cy: 24, r: RING_RADIUS, fill: 'none', stroke: accent, strokeWidth: 3, strokeLinecap: 'round',
            strokeDasharray: `${RING_LENGTH}`, strokeDashoffset: String(RING_LENGTH * (1 - progress)),
            transform: 'rotate(-90 24 24)'
          })
        ),
        h('div', { className: 'dsh-pomodoro__main' },
          h('div', { className: 'dsh-pomodoro__phase' }, t(state.phase)),
          h('div', { className: 'dsh-pomodoro__time', role: 'timer' }, text),
          h('div', { className: 'dsh-pomodoro__meta' },
            h('span', { className: 'dsh-pomodoro__dot' }),
            h('span', null, `${state.completed} ${t(state.completed === 1 ? 'round' : 'rounds')}`)
          )
        ),
        h('div', { className: 'dsh-pomodoro__actions' },
          h('button', {
            type: 'button', className: 'dsh-pomodoro__btn dsh-pomodoro__btn--primary', onClick: toggle,
            'aria-label': state.running ? t('pause') : t('start')
          }, state.running ? t('pause') : t('start')),
          h('button', { type: 'button', className: 'dsh-pomodoro__btn', onClick: skip, 'aria-label': t('skip') }, t('skip')),
          h('button', { type: 'button', className: 'dsh-pomodoro__btn', onClick: reset, 'aria-label': t('reset') }, t('reset'))
        )
      );
    };

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, {
          en: { title: 'Pomodoro', focus: 'Focus', short: 'Short break', long: 'Long break', start: 'Start', pause: 'Pause', skip: 'Skip', reset: 'Reset', round: 'pomodoro', rounds: 'pomodoros' },
          zh: { title: '番茄钟', focus: '专注', short: '短休息', long: '长休息', start: '开始', pause: '暂停', skip: '跳过', reset: '重置', round: '个番茄', rounds: '个番茄' }
        }), 'pomodoro: dictionaries');
        const t = ctx.locale.bind(NS);
        // One shared interval drives the countdown and rolls finished phases over.
        ctx.effect(() => {
          const id = setInterval(() => {
            if (!state.running) return;
            if (state.endsAt != null && Date.now() >= state.endsAt) {
              chime();
              const next = advance(state);
              commit({ ...next, running: true, endsAt: Date.now() + next.remaining, remaining: next.remaining });
              return;
            }
            emit();
          }, 250);
          return () => clearInterval(id);
        }, 'pomodoro: countdown');
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'pomodoro',
          order: 20,
          locale: NS,
          label: () => t('title')
        }, () => h(Pomodoro, { t })));
      }
    };
  }
});
