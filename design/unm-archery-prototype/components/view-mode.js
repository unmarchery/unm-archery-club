// TEMPORARY prototype helper (not for the real site): a "View as Member | Guest" switch plus a tiny
// mock account kept in localStorage, so the Shop and Book pages agree with each other.
// In the real site the role, passes and bookings come from the signed-in account.
(() => {
  const KEY = 'uac-proto-v2';   // bumped when the mock data shape changes
  const defaults = {
    view: 'member',
    user: { handle: 'cheng', name: 'Cheng', initials: 'CC' },
    passes: { hour: 2, day: 0 },
    bookings: [
      { id: 'b1', day: 'tue-24', date: 'Tue 24 Nov', time: '5–6pm', equip: 'club', hand: 'Right', lbs: '18 lbs', bow: 'Club bow · Right · 18 lbs' },
    ],
  };
  const read = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...defaults }; } };
  let state = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const qs = new URLSearchParams(location.search).get('view');
  if (qs === 'guest' || qs === 'member') { state.view = qs; save(); }

  const emit = () => {
    document.documentElement.dataset.view = state.view;
    document.dispatchEvent(new CustomEvent('club:change', { detail: state }));
  };

  window.club = {
    get state() { return state; },
    set(patch) { state = { ...state, ...patch }; save(); emit(); },
    addBooking(b) { state.bookings = [...state.bookings, { id: 'b' + Date.now(), ...b }]; save(); emit(); },
    cancelBooking(id) { state.bookings = state.bookings.filter((b) => b.id !== id); save(); emit(); },
    usePass(kind) { if (state.passes[kind] > 0) { state.passes = { ...state.passes, [kind]: state.passes[kind] - 1 }; save(); emit(); return true; } return false; },
    reset() { state = { ...defaults }; save(); emit(); },
  };

  // floating switch, bottom-left, clearly marked as a prototype control
  const sw = document.createElement('div');
  sw.className = 'view-switch';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Prototype: view as');
  sw.innerHTML = '<span class="view-switch__label">VIEW AS</span><button type="button" data-v="member">Member</button><button type="button" data-v="guest">Guest</button>';
  const sync = () => sw.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.view)));
  sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) window.club.set({ view: b.dataset.v }); });
  document.addEventListener('club:change', sync);
  const mount = () => { document.body.append(sw); sync(); emit(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
