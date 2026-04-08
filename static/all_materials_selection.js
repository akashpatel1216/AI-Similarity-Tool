let courseAId, courseBId, courseAName, courseBName;
let dataA = { files: [], assignments: [], discussions: [] };
let dataB = { files: [], assignments: [], discussions: [] };
let selectedA = { files: new Set(), assignments: new Set(), discussions: new Set() };
let selectedB = { files: new Set(), assignments: new Set(), discussions: new Set() };

document.addEventListener('DOMContentLoaded', function() {
    courseAId = sessionStorage.getItem('course_a_id');
    courseBId = sessionStorage.getItem('course_b_id');
    courseAName = sessionStorage.getItem('course_a_name');
    courseBName = sessionStorage.getItem('course_b_name');

    document.getElementById('course-a-name').textContent = courseAName || 'Course A';
    document.getElementById('course-b-name').textContent = courseBName || 'Course B';

    Promise.all([
        loadAllForCourse('a', courseAId),
        loadAllForCourse('b', courseBId)
    ]).catch(err => console.error(err));
});

async function loadAllForCourse(side, courseId) {
    const apiToken = side === 'a'
        ? (sessionStorage.getItem('canvas_api_token_a') || sessionStorage.getItem('api_token_a') || sessionStorage.getItem('api_token'))
        : (sessionStorage.getItem('canvas_api_token_b') || sessionStorage.getItem('api_token_b') || sessionStorage.getItem('api_token'));
    const canvasUrl = side === 'a'
        ? (sessionStorage.getItem('canvas_url_a') || sessionStorage.getItem('canvas_url') || 'https://usflearn.instructure.com')
        : (sessionStorage.getItem('canvas_url_b') || sessionStorage.getItem('canvas_url') || 'https://usflearn.instructure.com');

    if (!courseId || !apiToken) {
        showError(side, 'Missing course ID or API token');
        return;
    }

    const [filesRes, assignmentsRes, discussionsRes] = await Promise.all([
        fetch('/api/files-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, api_token: apiToken, canvas_url: canvasUrl })
        }),
        fetch('/api/assignments-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, api_token: apiToken, canvas_url: canvasUrl })
        }),
        fetch('/api/discussions-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, api_token: apiToken, canvas_url: canvasUrl })
        })
    ]);

    const filesData = await filesRes.json();
    const assignmentsData = await assignmentsRes.json();
    const discussionsData = await discussionsRes.json();

    if (!filesRes.ok || !filesData.success) throw new Error(filesData.error || 'Failed loading files');
    if (!assignmentsRes.ok || !assignmentsData.success) throw new Error(assignmentsData.error || 'Failed loading assignments');
    if (!discussionsRes.ok || !discussionsData.success) throw new Error(discussionsData.error || 'Failed loading discussions');

    const target = side === 'a' ? dataA : dataB;
    target.files = filesData.files || [];
    target.assignments = assignmentsData.assignments || [];
    target.discussions = discussionsData.discussions || [];

    renderCourseMaterials(side);
    updateCounts();
}

function renderCourseMaterials(side) {
    const target = side === 'a' ? dataA : dataB;
    const selected = side === 'a' ? selectedA : selectedB;
    const listEl = document.getElementById(`file-list-${side}`);

    function renderSection(title, type, items, nameKey, metaFormatter) {
        const rows = items.map(item => {
            const id = item.id;
            const checked = selected[type].has(id) ? 'checked' : '';
            const label = escapeHtml(item[nameKey] || item.name || item.title || 'Untitled');
            const meta = escapeHtml(metaFormatter(item));
            return `
                <div class="file-item" onclick="toggleItem('${side}', '${type}', ${id})">
                    <input type="checkbox" class="file-checkbox" id="${type}-${side}-${id}"
                        ${checked}
                        onclick="event.stopPropagation(); toggleItem('${side}', '${type}', ${id})">
                    <div class="file-info">
                        <div class="file-name">${label}</div>
                        <div class="file-meta"><span>${meta}</span></div>
                    </div>
                </div>
            `;
        }).join('');
        return `
            <div style="padding: 10px 0 4px; font-weight: 700; color: #006747;">${title} (${items.length})</div>
            ${rows || '<div class="loading">No items found</div>'}
        `;
    }

    listEl.innerHTML = [
        renderSection('Lecture Files', 'files', target.files, 'name', f => `${f.type || 'file'} · ${f.size_mb || 0} MB`),
        renderSection('Graded Materials', 'assignments', target.assignments, 'name', a => `${a.points_possible || 0} pts`),
        renderSection('Discussion Posts', 'discussions', target.discussions, 'title', d => d.author_name ? `By ${d.author_name}` : 'Professor Post')
    ].join('');
}

function toggleItem(side, type, id) {
    const selected = side === 'a' ? selectedA : selectedB;
    const checkbox = document.getElementById(`${type}-${side}-${id}`);
    const item = checkbox && checkbox.closest('.file-item');
    if (selected[type].has(id)) {
        selected[type].delete(id);
        if (item) item.classList.remove('selected');
    } else {
        selected[type].add(id);
        if (item) item.classList.add('selected');
    }
    if (checkbox) checkbox.checked = selected[type].has(id);
    updateCounts();
}

function selectAllCourse(side) {
    const target = side === 'a' ? dataA : dataB;
    const selected = side === 'a' ? selectedA : selectedB;
    ['files', 'assignments', 'discussions'].forEach(type => {
        (target[type] || []).forEach(item => {
            selected[type].add(item.id);
            const checkbox = document.getElementById(`${type}-${side}-${item.id}`);
            const row = checkbox && checkbox.closest('.file-item');
            if (checkbox) checkbox.checked = true;
            if (row) row.classList.add('selected');
        });
    });
    updateCounts();
}

function deselectAllCourse(side) {
    const target = side === 'a' ? dataA : dataB;
    const selected = side === 'a' ? selectedA : selectedB;
    ['files', 'assignments', 'discussions'].forEach(type => {
        (target[type] || []).forEach(item => {
            selected[type].delete(item.id);
            const checkbox = document.getElementById(`${type}-${side}-${item.id}`);
            const row = checkbox && checkbox.closest('.file-item');
            if (checkbox) checkbox.checked = false;
            if (row) row.classList.remove('selected');
        });
    });
    updateCounts();
}

function countSelected(sideObj) {
    return sideObj.files.size + sideObj.assignments.size + sideObj.discussions.size;
}

function updateCounts() {
    const countA = countSelected(selectedA);
    const countB = countSelected(selectedB);
    const total = countA + countB;

    document.getElementById('course-a-count').textContent = `${countA} item${countA !== 1 ? 's' : ''} selected`;
    document.getElementById('course-b-count').textContent = `${countB} item${countB !== 1 ? 's' : ''} selected`;
    document.getElementById('total-selected').textContent = `${total} item${total !== 1 ? 's' : ''} selected total`;
    document.getElementById('btn-continue').disabled = !(countA > 0 && countB > 0);
}

function continueToExtraction() {
    if (countSelected(selectedA) === 0 || countSelected(selectedB) === 0) {
        alert('Please select at least one material from each course');
        return;
    }

    // Save dedicated keys
    sessionStorage.setItem('selected_all_file_ids_a', JSON.stringify(Array.from(selectedA.files)));
    sessionStorage.setItem('selected_all_file_ids_b', JSON.stringify(Array.from(selectedB.files)));
    sessionStorage.setItem('selected_all_assignment_ids_a', JSON.stringify(Array.from(selectedA.assignments)));
    sessionStorage.setItem('selected_all_assignment_ids_b', JSON.stringify(Array.from(selectedB.assignments)));
    sessionStorage.setItem('selected_all_discussion_ids_a', JSON.stringify(Array.from(selectedA.discussions)));
    sessionStorage.setItem('selected_all_discussion_ids_b', JSON.stringify(Array.from(selectedB.discussions)));

    // Also update standard keys so export flow works with selected data
    sessionStorage.setItem('selected_files_a', JSON.stringify(Array.from(selectedA.files)));
    sessionStorage.setItem('selected_files_b', JSON.stringify(Array.from(selectedB.files)));
    sessionStorage.setItem('selected_assignment_ids_a', JSON.stringify(Array.from(selectedA.assignments)));
    sessionStorage.setItem('selected_assignment_ids_b', JSON.stringify(Array.from(selectedB.assignments)));
    sessionStorage.setItem('selected_discussion_ids_a', JSON.stringify(Array.from(selectedA.discussions)));
    sessionStorage.setItem('selected_discussion_ids_b', JSON.stringify(Array.from(selectedB.discussions)));

    sessionStorage.setItem('material_type', 'all_selected');
    window.location.href = '/extraction?material_type=all_selected';
}

function showError(side, message) {
    const listEl = document.getElementById(`file-list-${side}`);
    listEl.innerHTML = `<div class="loading" style="color: #c33;">Error: ${escapeHtml(message)}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}
