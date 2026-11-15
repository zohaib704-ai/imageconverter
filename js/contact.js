/* ============================================================
   js/contact.js — Contact form (Web3Forms)
   ============================================================ */

/* ------------------------------------------------------------
   HOW TO ACTIVATE:
   1. Go to https://web3forms.com
   2. Enter your email → click "Create Access Key"
   3. Check your email → copy the access key
   4. Replace "YOUR_ACCESS_KEY_HERE" below with your key
   5. Messages from the site will now arrive in your email inbox
   ------------------------------------------------------------ */
const WEB3FORMS_ACCESS_KEY = "YOUR_ACCESS_KEY_HERE";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const name = document.getElementById('cf-name').value.trim();
        const email = document.getElementById('cf-email').value.trim();
        const subject = document.getElementById('cf-subject').value.trim();
        const message = document.getElementById('cf-message').value.trim();
        const status = document.getElementById('contactStatus');
        const btn = form.querySelector('.submit-btn');

        if (!name || !email || !subject || !message) {
            showStatus(status, 'Please fill in all fields.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Sending…';
        status.classList.remove('show');

        // If no key is set, fall back to mailto
        if (WEB3FORMS_ACCESS_KEY === 'YOUR_ACCESS_KEY_HERE') {
            const mailto = `mailto:youremail@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${name} <${email}>\n\n${message}`)}`;
            window.location.href = mailto;
            showStatus(status, 'Opening your email app… (Web3Forms not configured)', 'error');
            btn.disabled = false;
            btn.textContent = 'Send Message';
            return;
        }

        try {
            const res = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    access_key: WEB3FORMS_ACCESS_KEY,
                    name, email, subject, message,
                    from_name: 'ImageResizer Pro'
                })
            });
            const data = await res.json();
            if (data.success) {
                showStatus(status, '✅ Message sent! I\'ll get back to you soon.', 'success');
                form.reset();
            } else {
                showStatus(status, '❌ Failed to send. Please try again.', 'error');
            }
        } catch {
            showStatus(status, '❌ Network error. Please try again.', 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Send Message';
    });
});

function showStatus(el, msg, type) {
    el.textContent = msg;
    el.className = 'status-message ' + type + ' show';
}
