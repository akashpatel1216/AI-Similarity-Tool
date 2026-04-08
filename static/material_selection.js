document.addEventListener('DOMContentLoaded', function() {
    // Load course names from session storage
    const courseAName = sessionStorage.getItem('course_a_name');
    const courseBName = sessionStorage.getItem('course_b_name');
    
    if (courseAName && courseBName) {
        document.getElementById('course-a-name').textContent = courseAName;
        document.getElementById('course-b-name').textContent = courseBName;
    } else {
        // Redirect back if no courses selected
        alert('Please select courses first');
        window.location.href = '/';
    }
});

function selectMaterial(materialType) {
    // Get stored data
    const courseAId = sessionStorage.getItem('course_a_id');
    const courseBId = sessionStorage.getItem('course_b_id');
    const apiTokenA = sessionStorage.getItem('api_token_a') || sessionStorage.getItem('api_token');
    const apiTokenB = sessionStorage.getItem('api_token_b') || sessionStorage.getItem('api_token');
    const canvasUrlA = sessionStorage.getItem('canvas_url_a') || sessionStorage.getItem('canvas_url');
    const canvasUrlB = sessionStorage.getItem('canvas_url_b') || sessionStorage.getItem('canvas_url');
    
    if (!courseAId || !courseBId || !apiTokenA || !apiTokenB || !canvasUrlA || !canvasUrlB) {
        alert('Missing course or configuration data. Please start over.');
        window.location.href = '/';
        return;
    }
    
    // Store per-course credentials for downstream pages
    sessionStorage.setItem('canvas_api_token_a', apiTokenA);
    sessionStorage.setItem('canvas_api_token_b', apiTokenB);
    sessionStorage.setItem('canvas_url_a', canvasUrlA);
    sessionStorage.setItem('canvas_url_b', canvasUrlB);
    
    // Store selected material type
    sessionStorage.setItem('material_type', materialType);
    
    if (materialType === 'lectures') {
        window.location.href = '/file-selection';
    } else if (materialType === 'graded_assignments') {
        window.location.href = '/assignment-selection';
    } else if (materialType === 'discussions') {
        window.location.href = '/discussion-selection';
    } else if (materialType === 'all_selected') {
        window.location.href = '/all-materials-selection';
    } else {
        window.location.href = `/extraction?courses_a=${courseAId}&courses_b=${courseBId}&material_type=${materialType}`;
    }
}
