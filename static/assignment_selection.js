let courseAId, courseBId, courseAName, courseBName;
let assignmentsA = [], assignmentsB = [];
let selectedA = new Set(), selectedB = new Set();

document.addEventListener('DOMContentLoaded', function() {
    courseAId = sessionStorage.getItem('course_a_id');
    courseBId = sessionStorage.getItem('course_b_id');
    courseAName = sessionStorage.getItem('course_a_name');
    courseBName = sessionStorage.getItem('course_b_name');

    document.getElementById('course-a-name').textContent = courseAName || 'Course A';
    document.getElementById('course-b-name').textContent = courseBName || 'Course B';

    loadAssignments('a', courseAId);
    loadAssignments('b', courseBId);
});

function loadAssignments(courseLabel, courseId) {
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

    fetch('/api/assignments-list', {
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
            if (courseLabel === 'a') {
                assignmentsA = data.assignments;
            } else {
                assignmentsB = data.assignments;
            }
            renderAssignments(courseLabel, data.assignments);
        } else {
            showError(courseLabel, data.error || 'Failed to load assignments');
        }
    })
    .catch(error => {
        console.error('Error loading assignments:', error);
        showError(courseLabel, 'Error loading assignments: ' + error.message);
    });
}

function renderAssignments(courseLabel, assignments) {
    const listEl = document.getElementById(`file-list-${courseLabel}`);

    if (!assignments || assignments.length === 0) {
        listEl.innerHTML = '<div class="loading">No graded assignments found</div>';
        return;
    }

    listEl.innerHTML = assignments.map(a => {
        const checked = (courseLabel === 'a' ? selectedA : selectedB).has(a.id) ? 'checked' : '';
        return `
        <div class="file-item" onclick="toggleAssignment('${courseLabel}', ${a.id})">
            <input type="checkbox" class="file-checkbox" id="assign-${courseLabel}-${a.id}"
                   ${checked} onclick="event.stopPropagation(); toggleAssignment('${courseLabel}', ${a.id})">
            <div class="file-info">
                <div class="file-name">${escapeHtml(a.name)}</div>
                <div class="file-meta">
                    <span>${a.points_possible} pts</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleAssignment(courseLabel, id) {
    const checkbox = document.getElementById(`assign-${courseLabel}-${id}`);
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
    const list = courseLabel === 'a' ? assignmentsA : assignmentsB;
    list.forEach(a => {
        if (courseLabel === 'a') selectedA.add(a.id);
        else selectedB.add(a.id);
        const cb = document.getElementById(`assign-${courseLabel}-${a.id}`);
        const item = cb && cb.closest('.file-item');
        if (cb) cb.checked = true;
        if (item) item.classList.add('selected');
    });
    updateCounts();
}

function deselectAll(courseLabel) {
    const list = courseLabel === 'a' ? assignmentsA : assignmentsB;
    list.forEach(a => {
        if (courseLabel === 'a') selectedA.delete(a.id);
        else selectedB.delete(a.id);
        const cb = document.getElementById(`assign-${courseLabel}-${a.id}`);
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
    document.getElementById('course-a-count').textContent = countA + ' assignment' + (countA !== 1 ? 's' : '') + ' selected';
    document.getElementById('course-b-count').textContent = countB + ' assignment' + (countB !== 1 ? 's' : '') + ' selected';
    document.getElementById('total-selected').textContent = total + ' assignment' + (total !== 1 ? 's' : '') + ' selected total';
    const btn = document.getElementById('btn-continue');
    btn.disabled = !(countA > 0 && countB > 0);
}

function continueToExtraction() {
    if (selectedA.size === 0 || selectedB.size === 0) {
        alert('Please select at least one graded assignment from each course');
        return;
    }
    sessionStorage.setItem('selected_assignment_ids_a', JSON.stringify(Array.from(selectedA)));
    sessionStorage.setItem('selected_assignment_ids_b', JSON.stringify(Array.from(selectedB)));
    sessionStorage.setItem('material_type', 'graded_assignments');
    window.location.href = '/extraction?material_type=graded_assignments';
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
