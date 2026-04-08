let courseAId, courseBId, courseAName, courseBName;
let courseAFiles = [], courseBFiles = [];
let selectedFilesA = new Set(), selectedFilesB = new Set();

document.addEventListener('DOMContentLoaded', function() {
    // Load course info from sessionStorage
    courseAId = sessionStorage.getItem('course_a_id');
    courseBId = sessionStorage.getItem('course_b_id');
    courseAName = sessionStorage.getItem('course_a_name');
    courseBName = sessionStorage.getItem('course_b_name');
    
    // Display course names
    document.getElementById('course-a-name').textContent = courseAName || 'Course A';
    document.getElementById('course-b-name').textContent = courseBName || 'Course B';
    
    // Load files for both courses
    loadFiles('a', courseAId);
    loadFiles('b', courseBId);
});

function loadFiles(courseLabel, courseId) {
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
    
    fetch('/api/files-list', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
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
                courseAFiles = data.files;
            } else {
                courseBFiles = data.files;
            }
            renderFiles(courseLabel, data.files);
        } else {
            showError(courseLabel, data.error || 'Failed to load files');
        }
    })
    .catch(error => {
        console.error('Error loading files:', error);
        showError(courseLabel, 'Error loading files: ' + error.message);
    });
}

function renderFiles(courseLabel, files) {
    const fileList = document.getElementById(`file-list-${courseLabel}`);
    
    if (files.length === 0) {
        fileList.innerHTML = '<div class="loading">No files found</div>';
        return;
    }
    
    fileList.innerHTML = files.map(file => `
        <div class="file-item" onclick="toggleFile('${courseLabel}', ${file.id})">
            <input type="checkbox" 
                   class="file-checkbox" 
                   id="file-${courseLabel}-${file.id}"
                   ${selectedFilesA.has(file.id) || selectedFilesB.has(file.id) ? 'checked' : ''}
                   onclick="event.stopPropagation(); toggleFile('${courseLabel}', ${file.id})">
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-meta">
                    <span class="file-type ${file.type}">${file.type}</span>
                    <span>${file.size_mb} MB</span>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleFile(courseLabel, fileId) {
    const checkbox = document.getElementById(`file-${courseLabel}-${fileId}`);
    const fileItem = checkbox.closest('.file-item');
    
    if (courseLabel === 'a') {
        if (selectedFilesA.has(fileId)) {
            selectedFilesA.delete(fileId);
            fileItem.classList.remove('selected');
        } else {
            selectedFilesA.add(fileId);
            fileItem.classList.add('selected');
        }
    } else {
        if (selectedFilesB.has(fileId)) {
            selectedFilesB.delete(fileId);
            fileItem.classList.remove('selected');
        } else {
            selectedFilesB.add(fileId);
            fileItem.classList.add('selected');
        }
    }
    
    checkbox.checked = courseLabel === 'a' ? selectedFilesA.has(fileId) : selectedFilesB.has(fileId);
    updateCounts();
}

function selectAll(courseLabel) {
    const files = courseLabel === 'a' ? courseAFiles : courseBFiles;
    files.forEach(file => {
        if (courseLabel === 'a') {
            selectedFilesA.add(file.id);
        } else {
            selectedFilesB.add(file.id);
        }
        const checkbox = document.getElementById(`file-${courseLabel}-${file.id}`);
        const fileItem = checkbox?.closest('.file-item');
        if (checkbox) checkbox.checked = true;
        if (fileItem) fileItem.classList.add('selected');
    });
    updateCounts();
}

function deselectAll(courseLabel) {
    const files = courseLabel === 'a' ? courseAFiles : courseBFiles;
    files.forEach(file => {
        if (courseLabel === 'a') {
            selectedFilesA.delete(file.id);
        } else {
            selectedFilesB.delete(file.id);
        }
        const checkbox = document.getElementById(`file-${courseLabel}-${file.id}`);
        const fileItem = checkbox?.closest('.file-item');
        if (checkbox) checkbox.checked = false;
        if (fileItem) fileItem.classList.remove('selected');
    });
    updateCounts();
}

function updateCounts() {
    const countA = selectedFilesA.size;
    const countB = selectedFilesB.size;
    const total = countA + countB;
    
    document.getElementById('course-a-count').textContent = `${countA} file${countA !== 1 ? 's' : ''} selected`;
    document.getElementById('course-b-count').textContent = `${countB} file${countB !== 1 ? 's' : ''} selected`;
    document.getElementById('total-selected').textContent = `${total} file${total !== 1 ? 's' : ''} selected total`;
    
    // Enable continue button if at least one file is selected from each course
    const btnContinue = document.getElementById('btn-continue');
    if (countA > 0 && countB > 0) {
        btnContinue.disabled = false;
    } else {
        btnContinue.disabled = true;
    }
}

function continueToExtraction() {
    if (selectedFilesA.size === 0 || selectedFilesB.size === 0) {
        alert('Please select at least one file from each course');
        return;
    }
    
    // Store selected file IDs in sessionStorage
    sessionStorage.setItem('selected_files_a', JSON.stringify(Array.from(selectedFilesA)));
    sessionStorage.setItem('selected_files_b', JSON.stringify(Array.from(selectedFilesB)));
    
    // Redirect to extraction page
    window.location.href = '/extraction?material_type=lectures';
}

function showError(courseLabel, message) {
    const fileList = document.getElementById(`file-list-${courseLabel}`);
    fileList.innerHTML = `<div class="loading" style="color: #c33;">Error: ${escapeHtml(message)}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
