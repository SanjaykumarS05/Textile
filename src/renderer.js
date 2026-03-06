const form = document.getElementById('login-form');
const message = document.getElementById('login-message');
const PAGE_TRANSITION_MS = 200;

const navigateWithTransition = (href) => {
  document.body.classList.add('page-leave');
  window.setTimeout(() => {
    window.location.href = href;
  }, PAGE_TRANSITION_MS);
};

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username')?.value ?? '';
    const password = document.getElementById('password')?.value ?? '';

    try {
      const result = await window.db.login(username, password);
      if (!result.ok) {
        if (message) message.textContent = result.message;
        return;
      }

      if (message) message.textContent = `Welcome ${result.user.name}`;
      navigateWithTransition('dashboard.html');
    } catch (error) {
      if (message) message.textContent = `Login failed: ${error.message}`;
    }
  });
}

