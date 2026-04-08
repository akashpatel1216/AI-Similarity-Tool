let courseAId, courseBId, courseAName, courseBName;
let discussionsA = [], discussionsB = [];
let selectedA = new Set(), selectedB = new Set();

document.addEventListener('DOMContentLoaded', function() {
    courseAId = sessionStorage.getItem('course_a_id');
    courseBId = sessionStorage.getItem('course_b_id');
    courseAName = sessionStorage.getItem('course_a_name');
    courseBName = sessionStorage.getItem('course_b_name');

    document.getElementById('course-a-name').textContent = courseAName || 'Course A';
    document.getElementById('course-b-name').textContent = courseBName || 'Course B';

    loadDiscussions('a', courseAId);
    loadDiscussions('b', courseBId);
});

function loadDiscussions(courseLabel, courseId) {
    const apiToken = courseLabel === 'a'
        ? (sessionStorage.getItem('canvas_api_token_a') || sessionStorage.getItem('api_token_a') || sessionStorage.getItem('api_token'))
        : (sessionStorage.getItem('canvas_api_token_b') || sessionStorage.getItem('api_token_b') || sessionStorage.getItem('api_token'));
    const canvasUrl = courseLabel === 'a'
        ? (sessionStorage.getItem('canvas_url_a') || sessionStorage.getItem('canvas_url') || 'https://usflearn.instructure.com')
        : (sessionStorage.getItem('canvas_url_b') || sessionStorage.getItem('canvas_url') || 'https://usflearn.instructure.com');

    if (!courseId || !apiToken) {
        showError(courseLabel, 'Missing course ID or API token');
        return;
    }

    fetch('/api/discussions-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            course_id: courseId,
            api_token: apiToken,
            canvas_url: canvasUrl
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (courseLabel === 'a') discussionsA = data.discussions;
            else discussionsB = data.discussions;
            renderDiscussions(courseLabel, data.discussions);
        } else {
            showError(courseLabel, data.error || 'Failed to load discussions');
        }
    })
    .catch(error => {
        console.error('Error loading discussions:', error);
        showError(courseLabel, 'Error loading discussions: ' + error.message);
    });
}

function renderDiscussions(courseLabel, discussions) {
    const listEl = document.getElementById(`file-list-${courseLabel}`);

    if (!discussions || discussions.length === 0) {
        listEl.innerHTML = '<div class="loading">No professor discussion posts found</div>';
        return;
    }

    listEl.innerHTML = discussions.map(d => {
        const checked = (courseLabel === 'a' ? selectedA : selectedB).has(d.id) ? 'checked' : '';
        const pointsText = d.graded ? `${d.points_possible || 0} pts` : 'Ungraded';
        const authorText = d.author_name ? `By ${escapeHtml(d.author_name)}` : 'Professor Post';
        return `
        <div class="file-item" onclick="toggleDiscussion('${courseLabel}', ${d.id})">
            <input type="checkbox" class="file-checkbox" id="discussion-${courseLabel}-${d.id}"
                   ${checked} onclick="event.stopPropagation(); toggleDiscussion('${courseLabel}', ${d.id})">
            <div class="file-info">
                <div class="file-name">${escapeHtml(d.title)}</div>
                <div class="file-meta">
                    <span>${authorText}</span>
                    <span>${pointsText}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleDiscussion(courseLabel, id) {
    const checkbox = document.getElementById(`discussion-${courseLabel}-${id}`);
    const item = checkbox && checkbox.closest('.file-item');
    if (courseLabel === 'a') {
        if (selectedA.has(id)) {
            selectedA.delete(id);
            if (item) item.classList.remove('selected');
        } else {
            selectedA.add(id);
            if (item) item.classList.add('selected');
        }
        checkbox.checked = selectedA.has(id);
    } else {
        if (selectedB.has(id)) {
            selectedB.delete(id);
            if (item) item.classList.remove('selected');
        } else {
            selectedB.add(id);
            if (item) item.classList.add('selected');
        }
        checkbox.checked = selectedB.has(id);
    }
    updateCounts();
}

function selectAll(courseLabel) {
    const list = courseLabel === 'a' ? discussionsA : discussionsB;
    list.forEach(d => {
        if (courseLabel === 'a') selectedA.add(d.id);
        else selectedB.add(d.id);
        const cb = document.getElementById(`discussion-${courseLabel}-${d.id}`);
        const item = cb && cb.closest('.file-item');
        if (cb) cb.checked = true;
        if (item) item.classList.add('selected');
    });
    updateCounts();
}

function deselectAll(courseLabel) {
    const list = courseLabel === 'a' ? discussionsA : discussionsB;
    list.forEach(d => {
        if (courseLabel === 'a') selectedA.delete(d.id);
        else selectedB.delete(d.id);
        const cb = document.getElementById(`discussion-${courseLabel}-${d.id}`);
        const item = cb && cb.closest('.file-item');
        if (cb) cb.checked = false;
        if (item) item.classList.remove('selected');
    });
    updateCounts();
}

function updateCounts() {
    const countA = selectedA.size;
    const countB = selectedB.size;
    const total = countA + countB;
    document.getElementById('course-a-count').textContent = countA + ' discussion' + (countA !== 1 ? 's' : '') + ' selected';
    document.getElementById('course-b-count').textContent = countB + ' discussion' + (countB !== 1 ? 's' : '') + ' selected';
    document.getElementById('total-selected').textContent = total + ' discussion' + (total !== 1 ? 's' : '') + ' selected total';
    const btn = document.getElementById('btn-continue');
    btn.disabled = !(countA > 0 && countB > 0);
}

function continueToExtraction() {
    if (selectedA.size === 0 || selectedB.size === 0) {
        alert('Please select at least one discussion post from each course');
        return;
    }
    sessionStorage.setItem('selected_discussion_ids_a', JSON.stringify(Array.from(selectedA)));
    sessionStorage.setItem('selected_discussion_ids_b', JSON.stringify(Array.from(selectedB)));
    sessionStorage.setItem('material_type', 'discussions');
    window.location.href = '/extraction?material_type=discussions';
}

function showError(courseLabel, message) {
    const listEl = document.getElementById(`file-list-${courseLabel}`);
    listEl.innerHTML = '<div class="loading" style="color: #c33;">Error: ' + escapeHtml(message) + '</div>';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
