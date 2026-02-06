// Home Page Interactive Book Opening

document.addEventListener('DOMContentLoaded', () => {
    const bookContainers = document.querySelectorAll('.book-container');

    bookContainers.forEach(container => {
        const book = container.querySelector('.book');
        const openBtn = container.querySelector('.open-bible-btn');
        const translation = container.dataset.translation;

        // Toggle book open/close on book click
        book.addEventListener('click', (e) => {
            // Don't toggle if clicking the button
            if (e.target.classList.contains('open-bible-btn')) {
                return;
            }

            // Close all other books
            bookContainers.forEach(other => {
                if (other !== container) {
                    other.classList.remove('open');
                }
            });

            // Toggle this book
            container.classList.toggle('open');
        });

        // Navigate to Bible reader on button click
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Navigate to index.html with translation parameter
                window.location.href = `index.html?translation=${translation}`;
            });
        }
    });

    // Close books when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.book-container')) {
            bookContainers.forEach(container => {
                container.classList.remove('open');
            });
        }
    });

    // Prevent default link behavior
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });
});
