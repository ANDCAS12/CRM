/**
 * @file Sign-in screen and invite acceptance (Access). Demo accounts make role testing fast.
 */
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { MIN_PASSWORD_LENGTH, acceptInvite, signIn } from '../../core/auth.js';
import { esc } from '../../utils/format.js';
import { ctx, state } from '../context.js';
import { $, $$ } from '../dom.js';

/**
 * Renders the sign-in screen into #login.
 * @param {(user:object)=>void} onSignedIn
 */
export function renderLogin(onSignedIn, mode = 'signin') {
  const el = $('#login');
  const demo = state().users.filter((u) => u.demo && u.status === USER_STATUS.ACTIVE);
  const field = (id, label, type, extra = '') =>
    `<label class="l" for="${id}" style="color:rgba(243,243,243,.65)">${label}</label><input id="${id}" type="${type}" ${extra}>`;
  el.innerHTML =
    mode === 'signin'
      ? `<div class="box"><div class="mark" style="width:40px;height:40px;font-size:15px">IK</div><h1>Sign in to IK CRM</h1><p>Pipeline, relationships and contracts for Insight Kitchen.</p>
      <form id="lForm" novalidate>${field('lE', 'Email', 'email', 'autocomplete="username"')}${field('lP', 'Password', 'password', 'autocomplete="current-password"')}
      <div id="lErr" role="alert" style="color:var(--gold);font-size:13px;min-height:18px;margin-bottom:6px"></div><button class="btn pri" type="submit">Sign in</button></form>
      <p style="margin:14px 0 0"><a href="#" id="toInvite" style="color:var(--gold)">Accept an invite</a></p>
      <div class="demo"><div class="lab">Demo accounts (password: demo). Try each to check role restrictions.</div>${demo.map((u) => `<button data-u="${esc(u.email)}">${esc(u.name)} <span>${ROLES[u.role]}</span></button>`).join('')}</div></div>`
      : `<div class="box"><div class="mark" style="width:40px;height:40px;font-size:15px">IK</div><h1>Accept your invite</h1><p>Enter the email your admin invited and the invite code they sent you, then choose a password.</p>
      <form id="iForm" novalidate>${field('iEm', 'Email', 'email', 'autocomplete="username"')}${field('iCode', 'Invite code', 'text', 'autocomplete="off"')}${field('iPw', `Password (at least ${MIN_PASSWORD_LENGTH} characters)`, 'password', 'autocomplete="new-password"')}
      <div id="iErr" role="alert" style="color:var(--gold);font-size:13px;min-height:18px;margin-bottom:6px"></div><button class="btn pri" type="submit">Set password and sign in</button></form>
      <p style="margin:14px 0 0"><a href="#" id="toSignin" style="color:var(--gold)">Back to sign in</a></p></div>`;

  if (mode === 'signin') {
    const submit = async (e) => {
      e?.preventDefault();
      const r = await signIn(state(), $('#lE').value, $('#lP').value);
      if (!r.ok) return void ($('#lErr').textContent = r.error);
      onSignedIn(r.user);
    };
    $('#lForm').addEventListener('submit', submit);
    $('#toInvite').onclick = (e) => (e.preventDefault(), renderLogin(onSignedIn, 'invite'));
    $$('[data-u]', el).forEach(
      (b) =>
        (b.onclick = () => {
          $('#lE').value = b.dataset.u;
          $('#lP').value = 'demo';
          submit();
        }),
    );
  } else {
    $('#iForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#iEm').value.trim().toLowerCase();
      const user = state().users.find((u) => u.email === email);
      try {
        if (!user || user.inviteToken !== $('#iCode').value.trim()) throw new Error('That email and invite code don’t match.'); // same message either way
        await acceptInvite(ctx.api, state(), user.inviteToken, $('#iPw').value);
        onSignedIn(user);
      } catch (err) {
        $('#iErr').textContent = err.message;
      }
    });
    $('#toSignin').onclick = (e) => (e.preventDefault(), renderLogin(onSignedIn, 'signin'));
  }
  if (!el.contains(document.activeElement)) el.querySelector('input')?.focus(); // immediate: a delayed focus could move the caret while the user types
}
