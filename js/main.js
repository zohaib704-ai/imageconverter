/* ============================================================
   js/main.js  —  Shared site behaviour (all pages)
   ============================================================ */

/* ---------------- Mobile Menu ---------------- */
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (!mobileMenu || !mobileMenuBtn) return;

    mobileMenu.classList.toggle('active');
    mobileMenuBtn.classList.toggle('active');

    // Animate hamburger icon
    const spans = mobileMenuBtn.querySelectorAll('span');
    if (mobileMenu.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
    } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (!mobileMenu || !mobileMenuBtn) return;

    const spans = mobileMenuBtn.querySelectorAll('span');

    mobileMenu.classList.remove('active');
    mobileMenuBtn.classList.remove('active');

    spans[0].style.transform = 'none';
    spans[1].style.opacity = '1';
    spans[2].style.transform = 'none';
}

/* ---------------- Contact Form ---------------- */
function handleContactSubmit() {
    const name = document.getElementById('name');
    const email = document.getElementById('email');
    const subject = document.getElementById('subject');
    const message = document.getElementById('message');

    if (!name || !email || !subject || !message) return;

    if (!name.value || !email.value || !subject.value || !message.value) {
        alert('Please fill in all fields');
        return;
    }

    // In a real implementation, you would send this to a server
    alert('Thank you for your message! We will get back to you soon.');

    // Clear form
    name.value = '';
    email.value = '';
    subject.value = '';
    message.value = '';
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', function () {
    // Mobile menu button
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', function (event) {
        const mobileMenu = document.getElementById('mobileMenu');
        const btn = document.getElementById('mobileMenuBtn');
        if (!mobileMenu || !btn) return;

        if (
            mobileMenu.classList.contains('active') &&
            !mobileMenu.contains(event.target) &&
            !btn.contains(event.target)
        ) {
            closeMobileMenu();
        }
    });

    console.log('ImageResizer Pro initialized successfully');
});