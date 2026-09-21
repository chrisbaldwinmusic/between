// Shared wiring for every `.signup-form` on the page (SignupSection + SignupStrip).
// Posts to /api/subscribe — a same-origin proxy to Sonic Boom's shared mailer.

type TurnstileGlobal = {
  render: (el: string | HTMLElement, opts: { sitekey: string }) => string;
  getResponse: (id?: string) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileGlobal }
}

function initSignupForms() {
  document.querySelectorAll<HTMLFormElement>('.signup-form').forEach(form => {
    if (form.dataset.wired) return;
    form.dataset.wired = '1';

    const sitekey = form.dataset.turnstileSitekey!;
    const mountEl = form.querySelector<HTMLElement>('.signup-form__turnstile')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('.signup-form__submit')!;
    const msgEl = form.querySelector<HTMLElement>('.signup-form__msg')!;
    let widgetId: string | undefined;

    function renderTurnstile() {
      if (window.turnstile) {
        widgetId = window.turnstile.render(mountEl, { sitekey });
      } else {
        setTimeout(renderTurnstile, 200);
      }
    }
    renderTurnstile();

    function showMessage(type: 'success' | 'error' | '', text: string) {
      msgEl.className = 'signup-form__msg' + (type ? ` signup-form__msg--${type}` : '');
      msgEl.textContent = text;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showMessage('', '');

      const email = form.querySelector<HTMLInputElement>('input[name="email"]')?.value.trim() ?? '';
      const name = form.querySelector<HTMLInputElement>('input[name="name"]')?.value.trim() ?? '';
      const token = window.turnstile ? window.turnstile.getResponse(widgetId) : '';

      if (!token) {
        showMessage('error', 'Please complete the verification check.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing up…';

      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, turnstileToken: token }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          showMessage('success', "You're on the list! Thanks for signing up.");
          form.reset();
        } else {
          showMessage('error', data?.error || 'Something went wrong. Please try again.');
        }
      } catch {
        showMessage('error', 'Something went wrong. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign up';
        if (window.turnstile && widgetId) window.turnstile.reset(widgetId);
      }
    });
  });
}

initSignupForms();
