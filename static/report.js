document.addEventListener('DOMContentLoaded', function() {
    loadReport();
    
    // Setup button handlers
    document.getElementById('copy-btn').addEventListener('click', copyReport);
});

async function loadReport() {
    try {
        // Get report from session storage
        const reportData = sessionStorage.getItem('comparison_results');
        
        if (!reportData) {
            throw new Error('No comparison results found. Please start a new comparison.');
        }
        
        const data = JSON.parse(reportData);
        
        // Update course names and terms
        document.getElementById('course-a-name').textContent = data.course_a.name;
        document.getElementById('course-b-name').textContent = data.course_b.name;
        const professorAName = sessionStorage.getItem('course_a_professor_name') || '';
        const professorBName = sessionStorage.getItem('course_b_professor_name') || '';
        const professorAEl = document.getElementById('course-a-professor');
        const professorBEl = document.getElementById('course-b-professor');
        if (professorAName) {
            professorAEl.textContent = professorAName;
            professorAEl.style.display = 'inline-block';
        }
        if (professorBName) {
            professorBEl.textContent = professorBName;
            professorBEl.style.display = 'inline-block';
        }

        const termA = document.getElementById('course-a-term');
        const termB = document.getElementById('course-b-term');
        if (data.course_a.term) { termA.textContent = data.course_a.term; termA.style.display = 'block'; }
        if (data.course_b.term) { termB.textContent = data.course_b.term; termB.style.display = 'block'; }
        const typeLabels = { syllabus: 'Syllabus', lectures: 'Lecture Materials', graded_assignments: 'Graded Materials', discussions: 'Discussion Posts', all_selected: 'All Selected Materials' };
        document.getElementById('material-type').textContent = typeLabels[data.material_type] || data.material_type;
        
        // Display report (normalize wording to avoid "vs")
        displayReport(data.report.report_text);
        
        // Enable action buttons
        document.getElementById('copy-btn').disabled = false;
        document.getElementById('export-btn').disabled = false;
        
    } catch (error) {
        console.error('Error loading report:', error);
        document.getElementById('report-content').innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h2 style="color: #e74c3c;">❌ Error Loading Report</h2>
                <p style="color: #7f8c8d; margin-top: 16px;">${error.message}</p>
                <button onclick="window.location.href='/'" style="margin-top: 24px; padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Return to Home
                </button>
            </div>
        `;
    }
}

function displayReport(markdownText) {
    const reportContent = document.getElementById('report-content');
    const normalizedText = normalizeReportText(markdownText || '');
    
    // Convert markdown to HTML (simple conversion)
    const html = convertMarkdownToHTML(normalizedText);
    
    reportContent.innerHTML = `<div class="report-markdown">${html}</div>`;
    
    // Scroll to top
    window.scrollTo(0, 0);
}

function convertMarkdownToHTML(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Tables (basic support)
    html = html.replace(/\n\|(.+)\|\n\|([-:\s|]+)\|\n(((\|.+\|\n)+))/g, function(match, headers, separator, rows) {
        const headerCells = headers.split('|').map(h => `<th>${h.trim()}</th>`).join('');
        const rowsHTML = rows.trim().split('\n').map(row => {
            const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rowsHTML}</tbody></table>`;
    });
    
    // Lists
    html = html.replace(/^\s*\n\* (.*)/gim, '<ul>\n<li>$1</li>\n</ul>');
    html = html.replace(/^\s*\n\d+\. (.*)/gim, '<ol>\n<li>$1</li>\n</ol>');
    
    // Fix consecutive list items
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/<\/ol>\s*<ol>/g, '');
    
    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<h/g, '<h');
    html = html.replace(/<\/h([1-6])>\s*<\/p>/g, '</h$1>');
    html = html.replace(/<p>\s*<table/g, '<table');
    html = html.replace(/<\/table>\s*<\/p>/g, '</table>');
    html = html.replace(/<p>\s*<ul/g, '<ul');
    html = html.replace(/<\/ul>\s*<\/p>/g, '</ul>');
    html = html.replace(/<p>\s*<ol/g, '<ol');
    html = html.replace(/<\/ol>\s*<\/p>/g, '</ol>');
    html = html.replace(/<p>\s*<pre/g, '<pre');
    html = html.replace(/<\/pre>\s*<\/p>/g, '</pre>');
    html = html.replace(/<p>\s*<hr/g, '<hr');
    html = html.replace(/<\/hr>\s*<\/p>/g, '');
    
    return html;
}

function copyReport() {
    const reportData = sessionStorage.getItem('comparison_results');
    if (!reportData) return;
    
    const data = JSON.parse(reportData);
    const reportText = normalizeReportText(data.report.report_text || '');
    
    navigator.clipboard.writeText(reportText).then(() => {
        const btn = document.getElementById('copy-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#27ae60';
        btn.style.color = 'white';
        btn.style.borderColor = '#27ae60';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy report: ' + err.message);
    });
}

function normalizeReportText(text) {
    // Enforce preferred wording on site: use "and" instead of "vs"/"VS"/"vs."
    return text.replace(/\bvs\.?\b/gi, 'and');
}

async function exportPDF() {
    const btn = document.getElementById('export-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating PDF...';
    btn.disabled = true;

    try {
        const reportData = JSON.parse(sessionStorage.getItem('comparison_results') || '{}');
        const courseAName = document.getElementById('course-a-name').textContent;
        const courseBName = document.getElementById('course-b-name').textContent;
        const professorA = sessionStorage.getItem('course_a_professor_name') || '';
        const professorB = sessionStorage.getItem('course_b_professor_name') || '';
        const termA = sessionStorage.getItem('course_a_term') || '';
        const termB = sessionStorage.getItem('course_b_term') || '';
        const materialType = document.getElementById('material-type').textContent;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 48;
        const contentW = pageW - margin * 2;
        let y = margin;

        const usf_green = [0, 103, 71];
        const usf_gold  = [207, 196, 147];
        const text_dark = [30, 30, 30];
        const text_mid  = [80, 80, 80];

        function checkPageBreak(needed = 20) {
            if (y + needed > pageH - margin) {
                doc.addPage();
                y = margin;
            }
        }

        function drawLine(color = usf_gold, lw = 0.75) {
            doc.setDrawColor(...color);
            doc.setLineWidth(lw);
            doc.line(margin, y, pageW - margin, y);
        }

        // ── Header bar ───────────────────────────────────────────────────
        doc.setFillColor(...usf_green);
        doc.rect(0, 0, pageW, 64, 'F');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Course Similarity Analysis — Concept Overlap Report', margin, 28);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Material Type: ${materialType}  ·  Generated: ${new Date().toLocaleString()}`, margin, 48);
        y = 80;

        // ── Gold divider ─────────────────────────────────────────────────
        drawLine(usf_gold, 1.5);
        y += 14;

        // ── Course badges side-by-side ───────────────────────────────────
        const badgeW = (contentW - 16) / 2;
        const badgeH = 60;

        function drawCourseBadge(x, label, name, professor, term) {
            doc.setFillColor(...usf_green);
            doc.roundedRect(x, y, badgeW, badgeH, 6, 6, 'F');
            doc.setDrawColor(...usf_gold);
            doc.setLineWidth(1);
            doc.roundedRect(x, y, badgeW, badgeH, 6, 6, 'S');

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(207, 196, 147);
            doc.text(label.toUpperCase(), x + 10, y + 14);

            if (professor) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(professor, x + 10, y + 26, { maxWidth: badgeW - 16 });
            }

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(220, 240, 230);
            const nameLines = doc.splitTextToSize(name, badgeW - 16);
            doc.text(nameLines.slice(0, 2), x + 10, professor ? y + 38 : y + 30);

            if (term) {
                doc.setFontSize(7.5);
                doc.setTextColor(207, 196, 147);
                doc.text(term, x + 10, y + 52);
            }
        }

        drawCourseBadge(margin, 'Course A', courseAName, professorA, termA);
        drawCourseBadge(margin + badgeW + 16, 'Course B', courseBName, professorB, termB);
        y += badgeH + 18;

        drawLine(usf_gold, 0.75);
        y += 14;

        // ── Report body ───────────────────────────────────────────────────
        const reportText = normalizeReportText(reportData.report?.report_text || '');
        const lines = reportText.split('\n');

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();

            if (line.startsWith('## ')) {
                checkPageBreak(32);
                y += 6;
                doc.setFillColor(0, 103, 71, 0.08);
                doc.setDrawColor(...usf_gold);
                doc.setLineWidth(0.5);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(...usf_green);
                const heading = line.replace(/^## /, '');
                const headH = 20;
                doc.setFillColor(230, 242, 237);
                doc.roundedRect(margin, y - 13, contentW, headH, 3, 3, 'F');
                doc.line(margin, y - 13, margin, y - 13 + headH);
                doc.text(heading, margin + 8, y + 2);
                y += headH;
                drawLine(usf_gold, 0.5);
                y += 8;

            } else if (line.startsWith('### ')) {
                checkPageBreak(22);
                y += 4;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10.5);
                doc.setTextColor(...usf_green);
                doc.text(line.replace(/^### /, ''), margin, y);
                y += 14;

            } else if (line.startsWith('#### ')) {
                checkPageBreak(16);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...text_dark);
                doc.text(line.replace(/^#### /, ''), margin, y);
                y += 13;

            } else if (/^\|.+\|$/.test(line)) {
                // Table row
                checkPageBreak(14);
                const isSep = /^\|[-:\s|]+\|$/.test(line);
                if (!isSep) {
                    const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
                    const isHeader = lines.indexOf(rawLine) < lines.length - 1 &&
                        /^\|[-:\s|]+\|$/.test(lines[lines.indexOf(rawLine) + 1] || '');
                    const cellW = contentW / Math.max(cells.length, 1);

                    if (isHeader) {
                        doc.setFillColor(...usf_green);
                        doc.rect(margin, y - 11, contentW, 14, 'F');
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.setTextColor(255, 255, 255);
                    } else {
                        doc.setFillColor(248, 250, 248);
                        doc.rect(margin, y - 11, contentW, 14, 'F');
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8);
                        doc.setTextColor(...text_dark);
                    }

                    cells.forEach((cell, i) => {
                        doc.text(cell, margin + cellW * i + 4, y, { maxWidth: cellW - 8 });
                    });

                    doc.setDrawColor(200, 220, 210);
                    doc.setLineWidth(0.3);
                    doc.line(margin, y + 3, pageW - margin, y + 3);
                    y += 14;
                }

            } else if (/^(\s*[-*•]\s+)/.test(line)) {
                checkPageBreak(14);
                const indent = /^\s{2,}/.test(line) ? 16 : 0;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(...text_dark);
                const text = line.replace(/^\s*[-*•]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1');
                const wrapped = doc.splitTextToSize('• ' + text, contentW - indent - 10);
                checkPageBreak(wrapped.length * 12 + 4);
                doc.text(wrapped, margin + indent + 8, y);
                y += wrapped.length * 12 + 3;

            } else if (/^\*\*(.+?)\*\*/.test(line)) {
                checkPageBreak(14);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5);
                doc.setTextColor(...text_dark);
                const cleaned = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
                const wrapped = doc.splitTextToSize(cleaned, contentW);
                checkPageBreak(wrapped.length * 12 + 2);
                doc.text(wrapped, margin, y);
                y += wrapped.length * 12 + 3;

            } else if (/^---+$/.test(line)) {
                checkPageBreak(10);
                drawLine([200, 200, 200], 0.5);
                y += 8;

            } else if (line.trim() === '') {
                y += 5;
            } else {
                checkPageBreak(14);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(...text_dark);
                const cleaned = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
                const wrapped = doc.splitTextToSize(cleaned, contentW);
                checkPageBreak(wrapped.length * 12 + 2);
                doc.text(wrapped, margin, y);
                y += wrapped.length * 12 + 3;
            }
        }

        // ── Footer on every page ──────────────────────────────────────────
        const totalPages = doc.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFillColor(...usf_green);
            doc.rect(0, pageH - 28, pageW, 28, 'F');
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(207, 196, 147);
            doc.text('University Course Similarity Analysis Tool', margin, pageH - 12);
            doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 12, { align: 'right' });
        }

        const safeA = courseAName.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 30);
        const safeB = courseBName.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 30);
        doc.save(`Similarity_Report_${safeA}_and_${safeB}.pdf`);

    } catch (err) {
        console.error('PDF export error:', err);
        alert('PDF generation failed: ' + err.message + '\n\nTip: Use File > Print > Save as PDF instead.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
