const MAX_PROFILES = 5;
let profiles = [];

document.addEventListener('DOMContentLoaded', function() {
    const configBtn = document.getElementById('config-btn');
    const supportBtn = document.getElementById('support-btn');
    const cancelConfigBtn = document.getElementById('cancel-config-btn');
    const configPanel = document.getElementById('config-panel');
    const supportModal = document.getElementById('support-modal');
    const supportModalClose = document.getElementById('support-modal-close');
    const addKeyBtn = document.getElementById('load-courses-btn');
    const continueBtn = document.getElementById('continue-btn');
    const professorASelect = document.getElementById('professor-a-select');
    const professorBSelect = document.getElementById('professor-b-select');
    const courseASelect = document.getElementById('course-a-1');
    const courseBSelect = document.getElementById('course-b-1');
    const courseASearch = document.getElementById('course-a-search');
    const courseBSearch = document.getElementById('course-b-search');
    const courseASemester = document.getElementById('course-a-semester');
    const courseBSemester = document.getElementById('course-b-semester');
    const courseAYear = document.getElementById('course-a-year');
    const courseBYear = document.getElementById('course-b-year');

    configBtn.addEventListener('click', function() {
        configPanel.classList.toggle('show');
        configPanel.classList.toggle('hidden');
    });
    if (supportBtn && supportModal && supportModalClose) {
        supportBtn.addEventListener('click', function() {
            supportModal.classList.remove('hidden');
        });
        supportModalClose.addEventListener('click', function() {
            supportModal.classList.add('hidden');
        });
        supportModal.addEventListener('click', function(event) {
            if (event.target === supportModal) {
                supportModal.classList.add('hidden');
            }
        });
    }
    cancelConfigBtn.addEventListener('click', function() {
        configPanel.classList.add('hidden');
        configPanel.classList.remove('show');
    });
    const aiKeyInput = document.getElementById('ai-api-key');
    if (aiKeyInput) {
        aiKeyInput.addEventListener('input', function() {
            sessionStorage.setItem('ai_api_key', aiKeyInput.value.trim());
        });
    }
    const llmModelInput = document.getElementById('llm-model');
    if (llmModelInput) {
        llmModelInput.addEventListener('input', function() {
            sessionStorage.setItem('llm_model', llmModelInput.value.trim());
        });
    }
    addKeyBtn.addEventListener('click', addProfessorProfile);
    continueBtn.addEventListener('click', continueToMaterialSelection);

    professorASelect.addEventListener('change', () => handleProfessorChange('a'));
    professorBSelect.addEventListener('change', () => handleProfessorChange('b'));
    courseASelect.addEventListener('change', updateContinueButton);
    courseBSelect.addEventListener('change', updateContinueButton);
    courseASearch.addEventListener('input', () => handleProfessorChange('a', true, true));
    courseBSearch.addEventListener('input', () => handleProfessorChange('b', true, true));
    courseASemester.addEventListener('change', () => handleProfessorChange('a', true, true));
    courseBSemester.addEventListener('change', () => handleProfessorChange('b', true, true));
    courseAYear.addEventListener('change', () => handleProfessorChange('a', true, true));
    courseBYear.addEventListener('change', () => handleProfessorChange('b', true, true));

    restoreSession();
});

function restoreSession() {
    profiles = JSON.parse(sessionStorage.getItem('canvas_profiles') || '[]');
    renderProfilesList();
    renderProfessorDropdowns();

    const professorAId = sessionStorage.getItem('selected_professor_a') || '';
    const professorBId = sessionStorage.getItem('selected_professor_b') || '';
    if (profiles.some(p => p.id === professorAId)) {
        document.getElementById('professor-a-select').value = professorAId;
    }
    if (profiles.some(p => p.id === professorBId)) {
        document.getElementById('professor-b-select').value = professorBId;
    }

    // Keep form convenient by restoring most recent config input
    if (profiles.length > 0) {
        const recent = profiles[profiles.length - 1];
        document.getElementById('canvas-url').value = recent.canvas_url || document.getElementById('canvas-url').value;
    }

    const aiKeyEl = document.getElementById('ai-api-key');
    if (aiKeyEl) {
        const stored = sessionStorage.getItem('ai_api_key') || sessionStorage.getItem('gemini_api_key') || '';
        aiKeyEl.value = stored;
        if (stored && !sessionStorage.getItem('ai_api_key')) {
            sessionStorage.setItem('ai_api_key', stored);
        }
    }
    const llmModelEl = document.getElementById('llm-model');
    if (llmModelEl) {
        llmModelEl.value = sessionStorage.getItem('llm_model') || '';
    }

    handleProfessorChange('a', true);
    handleProfessorChange('b', true);
    updateContinueButton();
}

function persistProfiles() {
    sessionStorage.setItem('canvas_profiles', JSON.stringify(profiles));
}

function getProfileById(profileId) {
    return profiles.find(p => p.id === profileId) || null;
}

function renderAll() {
    renderProfilesList();
    renderProfessorDropdowns();
    updateContinueButton();
}

function renderProfilesList() {
    const container = document.getElementById('profiles-list');
    if (!container) return;

    if (profiles.length === 0) {
        container.innerHTML = '<p class="profiles-empty">No API keys added yet. Add up to 5 professors.</p>';
        return;
    }

    container.innerHTML = profiles.map(profile => `
        <div class="profile-card">
            <div>
                <div class="profile-name">${escapeHtml(profile.name)}</div>
                <div class="profile-meta">${profile.courses.length} courses · ${escapeHtml(profile.canvas_url)}</div>
            </div>
            <button class="profile-remove-btn" onclick="removeProfile('${profile.id}')">Remove</button>
        </div>
    `).join('');
}

function renderProfessorDropdowns() {
    const professorASelect = document.getElementById('professor-a-select');
    const professorBSelect = document.getElementById('professor-b-select');
    const previousA = professorASelect.value;
    const previousB = professorBSelect.value;

    const baseOption = '<option value="">Select a professor</option>';
    const options = profiles.map(profile => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`).join('');
    professorASelect.innerHTML = baseOption + options;
    professorBSelect.innerHTML = baseOption + options;

    professorASelect.disabled = profiles.length === 0;
    professorBSelect.disabled = profiles.length === 0;

    if (profiles.some(p => p.id === previousA)) professorASelect.value = previousA;
    if (profiles.some(p => p.id === previousB)) professorBSelect.value = previousB;
}

async function addProfessorProfile() {
    const apiToken = document.getElementById('api-token').value.trim();
    const canvasUrl = document.getElementById('canvas-url').value.trim();
    const loadingMsg = document.getElementById('loading-message');
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');

    loadingMsg.classList.add('hidden');
    errorMsg.classList.add('hidden');
    successMsg.classList.add('hidden');

    if (!apiToken) {
        errorMsg.textContent = 'Please enter a Canvas API token.';
        errorMsg.classList.remove('hidden');
        return;
    }
    if (!canvasUrl) {
        errorMsg.textContent = 'Please enter a Canvas URL.';
        errorMsg.classList.remove('hidden');
        return;
    }
    if (profiles.length >= MAX_PROFILES && !profiles.some(p => p.api_token === apiToken && p.canvas_url === canvasUrl)) {
        errorMsg.textContent = `You can only store up to ${MAX_PROFILES} API keys.`;
        errorMsg.classList.remove('hidden');
        return;
    }

    loadingMsg.classList.remove('hidden');

    try {
        const [userRes, coursesRes] = await Promise.all([
            fetch('/api/canvas-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_token: apiToken, canvas_url: canvasUrl })
            }),
            fetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_token: apiToken, canvas_url: canvasUrl })
            })
        ]);

        const userData = await userRes.json();
        const coursesData = await coursesRes.json();

        if (!userRes.ok) {
            throw new Error(userData.error || 'Unable to read Canvas user profile from this key.');
        }
        if (!coursesRes.ok) {
            throw new Error(coursesData.error || 'Unable to load courses from this key.');
        }

        const profileName = userData.name || userData.short_name || userData.login_id || 'Professor';
        const courseList = coursesData.courses || [];

        const existing = profiles.find(p => p.api_token === apiToken && p.canvas_url === canvasUrl);
        if (existing) {
            existing.name = profileName;
            existing.courses = courseList;
        } else {
            profiles.push({
                id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: profileName,
                api_token: apiToken,
                canvas_url: canvasUrl,
                courses: courseList
            });
        }

        persistProfiles();
        renderAll();

        // Keep global badge useful on other pages
        sessionStorage.setItem('canvas_user_name', profileName);
        if (typeof renderCanvasUserBadge === 'function') {
            renderCanvasUserBadge();
        }

        successMsg.textContent = `Added ${profileName} (${courseList.length} courses).`;
        successMsg.classList.remove('hidden');
        document.getElementById('api-token').value = '';

        // Auto-select first two professors if not chosen yet
        autoPickProfessors();
        loadingMsg.classList.add('hidden');
    } catch (error) {
        loadingMsg.classList.add('hidden');
        errorMsg.textContent = `Error: ${error.message}`;
        errorMsg.classList.remove('hidden');
    }
}

function autoPickProfessors() {
    const professorASelect = document.getElementById('professor-a-select');
    const professorBSelect = document.getElementById('professor-b-select');
    if (!professorASelect.value && profiles[0]) {
        professorASelect.value = profiles[0].id;
        handleProfessorChange('a', false);
    }
    if (!professorBSelect.value && profiles[1]) {
        professorBSelect.value = profiles[1].id;
        handleProfessorChange('b', false);
    }
}

function parseTermInfo(termName) {
    const text = String(termName || '');
    const lower = text.toLowerCase();
    let semester = '';
    if (/\bfall\b|\bfa\b/.test(lower)) semester = 'Fall';
    else if (/\bspring\b|\bsp\b/.test(lower)) semester = 'Spring';
    else if (/\bsummer\b|\bsu\b/.test(lower)) semester = 'Summer';
    else if (/\bwinter\b|\bwi\b/.test(lower)) semester = 'Winter';

    let year = '';
    const yearMatch4 = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch4) {
        year = yearMatch4[0];
    } else {
        // Canvas terms are sometimes like "Fall 25" or "SP 26"
        const yearMatch2 = text.match(/(?:^|[^\d])(?:'|’)?(\d{2})(?=$|[^\d])/);
        if (yearMatch2) {
            const yy = Number(yearMatch2[1]);
            const currentYY = new Date().getFullYear() % 100;
            const fullYear = yy <= currentYY + 5 ? 2000 + yy : 1900 + yy;
            year = String(fullYear);
        }
    }
    return { semester, year };
}

function populateTermFilters(side, courses) {
    const semesterSelect = document.getElementById(`course-${side}-semester`);
    const yearSelect = document.getElementById(`course-${side}-year`);
    if (!semesterSelect || !yearSelect) return;

    const prevSemester = semesterSelect.value;
    const prevYear = yearSelect.value;

    const semesters = new Set();
    const years = new Set();
    courses.forEach(course => {
        const info = parseTermInfo(course.term_name);
        if (info.semester) semesters.add(info.semester);
        if (info.year) years.add(info.year);
    });

    const semesterOrder = ['Spring', 'Summer', 'Fall', 'Winter'];
    const sortedSemesters = semesterOrder.filter(s => semesters.has(s));
    const currentYear = new Date().getFullYear();
    const baselineYears = [];
    for (let y = currentYear; y > currentYear - 10; y--) {
        baselineYears.push(String(y));
    }
    baselineYears.forEach(y => years.add(y));
    const sortedYears = Array.from(years).sort((a, b) => Number(b) - Number(a));

    semesterSelect.innerHTML = '<option value="">All Semesters</option>' +
        sortedSemesters.map(s => `<option value="${s}">${s}</option>`).join('');
    yearSelect.innerHTML = '<option value="">All Years</option>' +
        sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');

    if (sortedSemesters.includes(prevSemester)) semesterSelect.value = prevSemester;
    if (sortedYears.includes(prevYear)) yearSelect.value = prevYear;
}

function handleProfessorChange(side, keepCourseSelection = true, preserveSearch = false) {
    const professorSelect = document.getElementById(`professor-${side}-select`);
    const courseSelect = document.getElementById(`course-${side}-1`);
    const searchInput = document.getElementById(`course-${side}-search`);
    const semesterSelect = document.getElementById(`course-${side}-semester`);
    const yearSelect = document.getElementById(`course-${side}-year`);
    const profile = getProfileById(professorSelect.value);
    const priorCourseId = keepCourseSelection ? courseSelect.value : '';
    const searchText = preserveSearch ? (searchInput.value || '').trim().toLowerCase() : '';
    const selectedSemester = preserveSearch ? (semesterSelect.value || '') : '';
    const selectedYear = preserveSearch ? (yearSelect.value || '') : '';

    courseSelect.innerHTML = '<option value="">Select a course</option>';
    if (!profile) {
        courseSelect.disabled = true;
        searchInput.value = '';
        searchInput.disabled = true;
        semesterSelect.innerHTML = '<option value="">All Semesters</option>';
        yearSelect.innerHTML = '<option value="">All Years</option>';
        semesterSelect.disabled = true;
        yearSelect.disabled = true;
        sessionStorage.removeItem(`selected_professor_${side}`);
        updateContinueButton();
        return;
    }

    populateTermFilters(side, profile.courses || []);
    semesterSelect.disabled = false;
    yearSelect.disabled = false;

    const visibleCourses = profile.courses.filter(course => {
        const info = parseTermInfo(course.term_name);
        if (selectedSemester && info.semester !== selectedSemester) return false;
        if (selectedYear && info.year !== selectedYear) return false;
        if (!searchText) return true;
        const searchable = `${course.course_code || ''} ${course.name || ''} ${course.term_name || ''}`.toLowerCase();
        return searchable.includes(searchText);
    });

    if (visibleCourses.length === 0) {
        const noMatchOption = document.createElement('option');
        noMatchOption.value = '';
        noMatchOption.textContent = 'No courses match selected filters';
        courseSelect.appendChild(noMatchOption);
    } else {
        visibleCourses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            const baseLabel = `${course.course_code || course.name} - ${course.name}`;
            option.textContent = course.term_name ? `${baseLabel} (${course.term_name})` : baseLabel;
            courseSelect.appendChild(option);
        });
    }
    courseSelect.disabled = false;
    searchInput.disabled = false;
    if (!preserveSearch) {
        searchInput.value = '';
    }

    if (priorCourseId && visibleCourses.some(c => String(c.id) === String(priorCourseId))) {
        courseSelect.value = priorCourseId;
    } else {
        const savedCourseId = sessionStorage.getItem(`course_${side}_id`);
        if (savedCourseId && visibleCourses.some(c => String(c.id) === String(savedCourseId))) {
            courseSelect.value = savedCourseId;
        }
    }

    sessionStorage.setItem(`selected_professor_${side}`, profile.id);
    updateContinueButton();
}

function updateContinueButton() {
    const professorA = document.getElementById('professor-a-select').value;
    const professorB = document.getElementById('professor-b-select').value;
    const courseA = document.getElementById('course-a-1').value;
    const courseB = document.getElementById('course-b-1').value;
    const continueBtn = document.getElementById('continue-btn');

    // Same API key / professor is OK: compare two different courses they teach.
    // If same professor is selected for both sides, courses must differ.
    const sameProfile = professorA && professorB && professorA === professorB;
    const coursesOk = courseA && courseB && (!sameProfile || String(courseA) !== String(courseB));

    continueBtn.disabled = !(professorA && professorB && coursesOk);
}

async function continueToMaterialSelection() {
    const professorAId = document.getElementById('professor-a-select').value;
    const professorBId = document.getElementById('professor-b-select').value;
    const courseA = document.getElementById('course-a-1');
    const courseB = document.getElementById('course-b-1');

    if (!professorAId || !professorBId || !courseA.value || !courseB.value) {
        alert('Please select Professor A, Professor B, and one course for each.');
        return;
    }
    if (professorAId === professorBId && String(courseA.value) === String(courseB.value)) {
        alert('You selected the same professor for both sides. Please choose two different courses to compare.');
        return;
    }

    const profileA = getProfileById(professorAId);
    const profileB = getProfileById(professorBId);
    if (!profileA || !profileB) {
        alert('Selected professor profile is missing. Please re-select.');
        return;
    }

    // Backward-compatible keys + new per-course keys
    sessionStorage.setItem('api_token', profileA.api_token);
    sessionStorage.setItem('canvas_url', profileA.canvas_url);
    sessionStorage.setItem('api_token_a', profileA.api_token);
    sessionStorage.setItem('api_token_b', profileB.api_token);
    sessionStorage.setItem('canvas_url_a', profileA.canvas_url);
    sessionStorage.setItem('canvas_url_b', profileB.canvas_url);
    sessionStorage.setItem('canvas_api_token_a', profileA.api_token);
    sessionStorage.setItem('canvas_api_token_b', profileB.api_token);

    sessionStorage.setItem('selected_professor_a', profileA.id);
    sessionStorage.setItem('selected_professor_b', profileB.id);

    sessionStorage.setItem('course_a_id', courseA.value);
    sessionStorage.setItem('course_b_id', courseB.value);
    sessionStorage.setItem('course_a_name', courseA.options[courseA.selectedIndex].text);
    sessionStorage.setItem('course_b_name', courseB.options[courseB.selectedIndex].text);
    const courseAObj = (profileA.courses || []).find(c => String(c.id) === String(courseA.value)) || {};
    const courseBObj = (profileB.courses || []).find(c => String(c.id) === String(courseB.value)) || {};
    sessionStorage.setItem('course_a_term', courseAObj.term_name || '');
    sessionStorage.setItem('course_b_term', courseBObj.term_name || '');

    // Resolve and store actual course instructor names for report display.
    let courseAProfessorName = profileA.name;
    let courseBProfessorName = profileB.name;
    try {
        const [instARes, instBRes] = await Promise.all([
            fetch('/api/course-instructors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_id: courseA.value,
                    api_token: profileA.api_token,
                    canvas_url: profileA.canvas_url
                })
            }),
            fetch('/api/course-instructors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_id: courseB.value,
                    api_token: profileB.api_token,
                    canvas_url: profileB.canvas_url
                })
            })
        ]);

        const instAData = await instARes.json();
        const instBData = await instBRes.json();

        if (instARes.ok && instAData.success && Array.isArray(instAData.instructors) && instAData.instructors.length > 0) {
            courseAProfessorName = instAData.instructors.map(i => i.name).join(' and ');
        }
        if (instBRes.ok && instBData.success && Array.isArray(instBData.instructors) && instBData.instructors.length > 0) {
            courseBProfessorName = instBData.instructors.map(i => i.name).join(' and ');
        }
    } catch (e) {
        console.warn('Could not resolve course instructors. Falling back to selected professor names.', e);
    }

    sessionStorage.setItem('course_a_professor_name', courseAProfessorName);
    sessionStorage.setItem('course_b_professor_name', courseBProfessorName);

    // Show selected course instructor names in global badge.
    sessionStorage.setItem('canvas_user_name', `${courseAProfessorName} and ${courseBProfessorName}`);
    if (typeof renderCanvasUserBadge === 'function') {
        renderCanvasUserBadge();
    }

    window.location.href = '/material-selection';
}

function removeProfile(profileId) {
    profiles = profiles.filter(p => p.id !== profileId);
    persistProfiles();

    const professorASelect = document.getElementById('professor-a-select');
    const professorBSelect = document.getElementById('professor-b-select');
    if (professorASelect.value === profileId) {
        professorASelect.value = '';
    }
    if (professorBSelect.value === profileId) {
        professorBSelect.value = '';
    }
    handleProfessorChange('a', false);
    handleProfessorChange('b', false);
    renderAll();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}
