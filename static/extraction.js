// Get parameters from URL or sessionStorage
const urlParams = new URLSearchParams(window.location.search);
let coursesA = urlParams.get('courses_a') ? urlParams.get('courses_a').split(',') : [];
let coursesB = urlParams.get('courses_b') ? urlParams.get('courses_b').split(',') : [];

// Fallback to sessionStorage if not in URL (e.g., coming from file selection)
if (coursesA.length === 0) {
    const courseAId = sessionStorage.getItem('course_a_id');
    if (courseAId) coursesA = [courseAId];
}
if (coursesB.length === 0) {
    const courseBId = sessionStorage.getItem('course_b_id');
    if (courseBId) coursesB = [courseBId];
}

const apiTokenA = sessionStorage.getItem('api_token_a') || sessionStorage.getItem('canvas_api_token_a') || sessionStorage.getItem('api_token');
const apiTokenB = sessionStorage.getItem('api_token_b') || sessionStorage.getItem('canvas_api_token_b') || sessionStorage.getItem('api_token');
const canvasUrlA = sessionStorage.getItem('canvas_url_a') || sessionStorage.getItem('canvas_url');
const canvasUrlB = sessionStorage.getItem('canvas_url_b') || sessionStorage.getItem('canvas_url');
const materialType = urlParams.get('material_type') || sessionStorage.getItem('material_type') || 'all';

let extractedDataA = null;
let extractedDataB = null;

document.addEventListener('DOMContentLoaded', function() {
    // Start extraction automatically
    startExtraction();
    
    // Setup comparison button handler
    const startComparisonBtn = document.getElementById('start-comparison-btn');
    if (startComparisonBtn) {
        startComparisonBtn.addEventListener('click', () => {
            startComparison();
        });
    }
});

function getAiApiKey() {
    return (sessionStorage.getItem('ai_api_key') || sessionStorage.getItem('gemini_api_key') || '').trim();
}

function getLlmModel() {
    return (sessionStorage.getItem('llm_model') || '').trim();
}

async function startExtraction() {
    try {
        // Validate we have required data
        if (coursesA.length === 0 || coursesB.length === 0) {
            throw new Error('Course IDs not found. Please go back and select courses again.');
        }
        
        if (!apiTokenA || !apiTokenB || !canvasUrlA || !canvasUrlB) {
            throw new Error('Professor credentials are incomplete. Please go back and reselect professors.');
        }

        const needsGemini = ['all', 'syllabus', 'lectures', 'all_selected'].includes(materialType);
        if (needsGemini && !getAiApiKey()) {
            throw new Error('AI API key is required. Open Configure Canvas on the home page, enter your LLM provider key, then try again (or set AI_API_KEY / GEMINI_API_KEY on the server).');
        }
        if (needsGemini && !getLlmModel()) {
            throw new Error('Model name is required. Open Configure Canvas and enter the model id (e.g. gemini-2.5-flash), or set LLM_MODEL on the server.');
        }
        
        const totalSteps = 2; // Course A + Course B
        let completed = 0;
        
        // Extract Course A
        updateCourseStatus('a', 'extracting', 'Extracting...');
        setExtractionItemsListPlaceholder('a', 'Extracting...');
        addLog('a', '📥 Starting extraction...', 'info');
        extractedDataA = await extractCourse(coursesA[0], 'a');
        completed++;
        updateProgress((completed / totalSteps) * 100);
        updateCourseStatus('a', 'complete', '✅ Complete');
        
        // Extract Course B
        updateCourseStatus('b', 'extracting', 'Extracting...');
        setExtractionItemsListPlaceholder('b', 'Extracting...');
        addLog('b', '📥 Starting extraction...', 'info');
        extractedDataB = await extractCourse(coursesB[0], 'b');
        completed++;
        updateProgress(100);
        updateCourseStatus('b', 'complete', '✅ Complete');
        
        // Show comparison button
        document.getElementById('comparison-section').classList.remove('hidden');
        
    } catch (error) {
        console.error('Extraction error:', error);
        addLog('a', `❌ Error: ${error.message}`, 'error');
        addLog('b', `❌ Error: ${error.message}`, 'error');
    }
}

async function extractCourse(courseId, courseLabel) {
    const logId = courseLabel; // 'a' or 'b'
    
    try {
        // Make API call
        addLog(logId, `🔍 Fetching course ${courseId}...`, 'info');
        
        // Get selected file IDs if material type is lectures
        let selectedFileIds = null;
        if (materialType === 'lectures') {
            const selectedFilesKey = courseLabel === 'a' ? 'selected_files_a' : 'selected_files_b';
            const selectedFilesJson = sessionStorage.getItem(selectedFilesKey);
            if (selectedFilesJson) {
                selectedFileIds = JSON.parse(selectedFilesJson);
            }
        } else if (materialType === 'all_selected') {
            const selectedFilesJson = sessionStorage.getItem(courseLabel === 'a' ? 'selected_all_file_ids_a' : 'selected_all_file_ids_b');
            if (selectedFilesJson) {
                selectedFileIds = JSON.parse(selectedFilesJson);
            }
        }
        // Get selected assignment IDs if material type is graded_assignments
        let selectedAssignmentIds = null;
        if (materialType === 'graded_assignments') {
            const key = courseLabel === 'a' ? 'selected_assignment_ids_a' : 'selected_assignment_ids_b';
            const json = sessionStorage.getItem(key);
            if (json) selectedAssignmentIds = JSON.parse(json);
        } else if (materialType === 'all_selected') {
            const key = courseLabel === 'a' ? 'selected_all_assignment_ids_a' : 'selected_all_assignment_ids_b';
            const json = sessionStorage.getItem(key);
            if (json) selectedAssignmentIds = JSON.parse(json);
        }
        // Get selected discussion IDs if material type is discussions
        let selectedDiscussionIds = null;
        if (materialType === 'discussions') {
            const key = courseLabel === 'a' ? 'selected_discussion_ids_a' : 'selected_discussion_ids_b';
            const json = sessionStorage.getItem(key);
            if (json) selectedDiscussionIds = JSON.parse(json);
        } else if (materialType === 'all_selected') {
            const key = courseLabel === 'a' ? 'selected_all_discussion_ids_a' : 'selected_all_discussion_ids_b';
            const json = sessionStorage.getItem(key);
            if (json) selectedDiscussionIds = JSON.parse(json);
        }
        
        const needsFresh = (materialType === 'lectures' || materialType === 'graded_assignments' || materialType === 'discussions' || materialType === 'all_selected');
        const requestBody = {
            course_id: courseId,
            api_token: courseLabel === 'a' ? apiTokenA : apiTokenB,
            canvas_url: courseLabel === 'a' ? canvasUrlA : canvasUrlB,
            force_refresh: needsFresh,
            material_type: materialType,
            ai_api_key: getAiApiKey(),
            llm_model: getLlmModel()
        };
        
        if (selectedFileIds && selectedFileIds.length > 0) {
            requestBody.selected_file_ids = selectedFileIds;
        }
        if (selectedAssignmentIds && selectedAssignmentIds.length > 0) {
            requestBody.selected_assignment_ids = selectedAssignmentIds;
        }
        if (selectedDiscussionIds && selectedDiscussionIds.length > 0) {
            requestBody.selected_discussion_ids = selectedDiscussionIds;
        }
        
        const response = await fetch('/api/extract-course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Extraction failed');
        }
        
        const data = result.data;
        
        // Update course header with course name
        document.getElementById(`course-${logId}-header`).textContent = 
            `📚 ${data.metadata.course_name || `Course ${courseLabel.toUpperCase()}`}`;
        
        // Show list of what is being extracted (assignments, lectures, quizzes, etc.)
        setExtractionItemsList(logId, data);
        
        // Check if loaded from cache
        if (result.from_cache) {
            addLog(logId, `💾 Loaded from cache`, 'success');
        }
        
        // Log material type being extracted
        addLog(logId, `📋 Material Type: ${materialType}`, 'info');
        
        // Log extracted materials
        if (materialType === 'syllabus' || materialType === 'all') {
            const syllabusCount = data.materials.syllabus ? data.materials.syllabus.length : 0;
            if (syllabusCount > 0) {
                addLog(logId, `📄 Extracting syllabus...`, 'info');
                const syllabus = data.materials.syllabus[0];
                addLog(logId, `  └─ ${syllabus.name}`, 'success');
                
                // Check if Gemini filtered
                if (syllabus.source_type === 'syllabus_filtered') {
                    addLog(logId, `  🤖 Gemini filtering syllabus...`, 'gemini');
                    
                    const filtered = syllabus.filtered_data;
                    if (filtered) {
                        if (filtered.course_objectives) {
                            addLog(logId, `     ✓ Course Objectives extracted`, 'gemini');
                        }
                        if (filtered.course_outline) {
                            addLog(logId, `     ✓ Course Outline extracted`, 'gemini');
                        }
                        if (filtered.learning_outcomes) {
                            addLog(logId, `     ✓ Learning Outcomes extracted`, 'gemini');
                        }
                        addLog(logId, `  ✅ Syllabus filtered successfully`, 'success');
                    }
                }
            }
        }
        
        if (materialType === 'assignments' || materialType === 'all') {
            const assignmentsCount = data.materials.assignments ? data.materials.assignments.length : 0;
            if (assignmentsCount > 0) {
                addLog(logId, `📝 Extracted ${assignmentsCount} assignments`, 'success');
            }
        }
        
        if (materialType === 'lectures' || materialType === 'all') {
            const lecturesCount = data.materials.lectures ? data.materials.lectures.length : 0;
            if (lecturesCount > 0) {
                addLog(logId, `📚 Extracted ${lecturesCount} lecture files`, 'success');
            }
        }
        
        if (materialType === 'quizzes' || materialType === 'all') {
            const quizzesCount = data.materials.quizzes ? data.materials.quizzes.length : 0;
            const questionsCount = data.materials.quiz_questions ? data.materials.quiz_questions.length : 0;
            if (quizzesCount > 0) {
                addLog(logId, `❓ Extracted ${quizzesCount} quizzes with ${questionsCount} questions`, 'success');
            }
        }
        
        if (materialType === 'discussions' || materialType === 'all') {
            const discussionsCount = data.materials.discussions ? data.materials.discussions.length : 0;
            if (discussionsCount > 0) {
                addLog(logId, `💬 Extracted ${discussionsCount} discussions`, 'success');
            }
        }
        
        // Total materials
        const totalMaterials = data.statistics.total_materials || 0;
        addLog(logId, `✅ Total: ${totalMaterials} materials extracted`, 'success');
        
        // Extraction errors if any
        if (data.statistics.extraction_errors && data.statistics.extraction_errors.length > 0) {
            data.statistics.extraction_errors.forEach(error => {
                addLog(logId, `⚠️ ${error}`, 'warning');
            });
        }
        
        return data;
        
    } catch (error) {
        addLog(logId, `❌ Extraction failed: ${error.message}`, 'error');
        throw error;
    }
}

function setExtractionItemsListPlaceholder(courseLabel, text) {
    const listEl = document.getElementById(`course-${courseLabel}-items`);
    if (!listEl) return;
    listEl.innerHTML = `<li class="muted">${escapeHtml(text)}</li>`;
}

function setExtractionItemsList(courseLabel, data) {
    const listEl = document.getElementById(`course-${courseLabel}-items`);
    if (!listEl) return;
    const items = [];
    const mats = data.materials || {};
    const type = materialType;
    if (type === 'syllabus' || type === 'all') {
        const syllabus = mats.syllabus;
        if (syllabus && syllabus.length > 0) {
            syllabus.forEach(s => items.push(s.name || 'Syllabus'));
        }
    }
    if (type === 'graded_assignments' || type === 'assignments' || type === 'all') {
        const assignments = mats.assignments || [];
        const quizzes = mats.quizzes || [];
        assignments.forEach(a => items.push(a.name || 'Assignment'));
        if (type === 'graded_assignments' || type === 'all') {
            quizzes.forEach(q => items.push(q.name || 'Quiz'));
        }
    }
    if (type === 'all_selected') {
        const lectures = mats.lectures || mats.files || [];
        const assignments = mats.assignments || [];
        const discussions = mats.discussions || [];
        lectures.forEach(f => items.push(f.name || f.display_name || 'File'));
        assignments.forEach(a => items.push(a.name || 'Assignment'));
        discussions.forEach(d => items.push(d.name || 'Discussion'));
    }
    if (type === 'lectures' || type === 'all') {
        const lectures = mats.lectures || mats.files || [];
        lectures.forEach(f => items.push(f.name || f.display_name || 'File'));
    }
    if (type === 'quizzes' || type === 'all') {
        const quizzes = mats.quizzes || [];
        quizzes.forEach(q => items.push(q.name || 'Quiz'));
    }
    if (type === 'discussions' || type === 'all') {
        const discussions = mats.discussions || [];
        discussions.forEach(d => items.push(d.name || 'Discussion'));
    }
    listEl.innerHTML = items.length ? items.map(name => `<li>${escapeHtml(name)}</li>`).join('') : '<li class="muted">No items</li>';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addLog(courseLabel, message, type = 'info') {
    const logContainer = document.getElementById(`course-${courseLabel}-log`);
    
    // Remove waiting message if exists
    const waitingMsg = logContainer.querySelector('.waiting');
    if (waitingMsg) {
        waitingMsg.remove();
    }
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = message;
    
    logContainer.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateCourseStatus(courseLabel, status, text) {
    const statusBadge = document.getElementById(`course-${courseLabel}-status`);
    statusBadge.className = `status-badge ${status}`;
    statusBadge.textContent = text;
}

function updateProgress(percentage) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
}

async function startComparison() {
    if (!getAiApiKey()) {
        addLog('a', '❌ Add your AI / LLM API key under Configure Canvas on the home page first.', 'error');
        addLog('b', '❌ Add your AI / LLM API key under Configure Canvas on the home page first.', 'error');
        return;
    }
    if (!getLlmModel()) {
        addLog('a', '❌ Enter your model name under Configure Canvas on the home page first.', 'error');
        addLog('b', '❌ Enter your model name under Configure Canvas on the home page first.', 'error');
        return;
    }
    // Show loading state
    const btn = document.getElementById('start-comparison-btn');
    btn.disabled = true;
    btn.innerHTML = '🔍 Generating Detailed Report... <div class="gemini-loading"></div>';
    
    addLog('a', '🤖 Starting AI comparison analysis...', 'gemini');
    addLog('b', '🤖 Starting AI comparison analysis...', 'gemini');
    
    try {
        const response = await fetch('/api/compare-with-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courses_a: coursesA,
                courses_b: coursesB,
                material_type: materialType,
                api_token: apiTokenA,
                canvas_url: canvasUrlA,
                ai_api_key: getAiApiKey(),
                llm_model: getLlmModel()
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Comparison failed');
        }
        
        addLog('a', '✅ Comparison complete!', 'success');
        addLog('b', '✅ Comparison complete!', 'success');
        
        // Store results and navigate to report page
        sessionStorage.setItem('comparison_results', JSON.stringify(result));
        window.location.href = '/comparison-report';
        
    } catch (error) {
        console.error('Comparison error:', error);
        addLog('a', `❌ Comparison failed: ${error.message}`, 'error');
        addLog('b', `❌ Comparison failed: ${error.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = '🔍 Start Comparison & Generate Report';
    }
}
