document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    const navLinks = document.querySelectorAll('.nav-links a');
    const hamburger = document.querySelector('.hamburger');
    const navLinksContainer = document.querySelector('.nav-links');
    
    // Modal elements
    const jobModal = document.getElementById('job-modal');
    const modalContent = document.getElementById('modal-job-details');
    const closeModalBtn = document.querySelector('.modal-close');

    // --- DEFAULTS & STATE ---
    const defaultPreferences = { roleKeywords: [], preferredLocations: [], preferredMode: [], experienceLevel: '', skills: [], minMatchScore: 40 };
    const jobStatusOptions = ['Not Applied', 'Applied', 'Rejected', 'Selected'];

    let savedJobs = JSON.parse(localStorage.getItem('savedJobs')) || [];
    let preferences = JSON.parse(localStorage.getItem('jobTrackerPreferences')) || defaultPreferences;
    let jobStatuses = JSON.parse(localStorage.getItem('jobTrackerStatus')) || {};
    
    const testItems = [
        { label: "Preferences persist after refresh", hint: "Change settings, refresh, and check if values remain." },
        { label: "Match score calculates correctly", hint: "Check if score badge matches the logic rules." },
        { label: "Show only matches toggle works", hint: "Toggle on dashboard and verify list filters by threshold." },
        { label: "Save job persists after refresh", hint: "Save a job, refresh, and check the Saved page." },
        { label: "Apply opens in new tab", hint: "Click Apply and verify it opens a new browser tab." },
        { label: "Status update persists after refresh", hint: "Change status, refresh, and verify badge color." },
        { label: "Status filter works correctly", hint: "Filter by 'Applied' or 'Selected' on dashboard." },
        { label: "Digest generates top 10 by score", hint: "Generate digest and verify order/count." },
        { label: "Digest persists for the day", hint: "Generate digest, refresh, and verify it doesn't ask to regenerate." },
        { label: "No console errors on main pages", hint: "Open DevTools and check for red errors while navigating." }
    ];
    let testStatus = JSON.parse(localStorage.getItem('jobTrackerTestStatus')) || new Array(testItems.length).fill(false);

    // --- HELPER FUNCTIONS ---
    const getSkillsAsBadges = (skills) => skills.map(skill => `<span class="skill-badge">${skill}</span>`).join('');
    const arePreferencesSet = () => JSON.stringify(preferences) !== JSON.stringify(defaultPreferences);
    const getTodayDateString = () => new Date().toISOString().slice(0, 10);

    const updateJobStatus = (jobId, newStatus) => {
        jobStatuses[jobId] = { status: newStatus, date: getTodayDateString() };
        localStorage.setItem('jobTrackerStatus', JSON.stringify(jobStatuses));
        showToast(`Status updated: ${newStatus}`);
        router(); // Re-render the current view to reflect status changes
    };
    
    const showToast = (message) => {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            document.body.removeChild(existingToast);
        }

        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.className = toast.className.replace('show', '');
            setTimeout(() => {
               if(document.body.contains(toast)) {
                 document.body.removeChild(toast);
               }
            }, 500);
        }, 3000);
    };

    // --- MATCH SCORE ENGINE ---
    const calculateMatchScore = (job, prefs) => {
        let score = 0;
        if (!arePreferencesSet()) return 0;
        const jobTitle = job.title.toLowerCase();
        const jobDesc = job.description.toLowerCase();
        const userKeywords = prefs.roleKeywords.map(k => k.toLowerCase());
        const userSkills = prefs.skills.map(s => s.toLowerCase());

        if (userKeywords.some(k => jobTitle.includes(k))) score += 25;
        if (userKeywords.some(k => jobDesc.includes(k))) score += 15;
        if (prefs.preferredLocations.includes(job.location)) score += 15;
        if (prefs.preferredMode.includes(job.mode)) score += 10;
        if (prefs.experienceLevel && job.experience === prefs.experienceLevel) score += 10;
        if (job.skills.some(s => userSkills.includes(s.toLowerCase()))) score += 15;
        if (job.postedDaysAgo <= 2) score += 5;
        if (job.source === 'LinkedIn') score += 5;

        return Math.min(score, 100);
    };

    const getScoreBadgeClass = (score) => {
        if (score >= 80) return 'score-high';
        if (score >= 60) return 'score-medium';
        if (score >= 40) return 'score-low';
        return 'score-none';
    };
    
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Applied': return 'status-applied';
            case 'Selected': return 'status-selected';
            case 'Rejected': return 'status-rejected';
            default: return 'status-not-applied';
        }
    };
    
    // --- TEMPLATING & DIGEST ---
    const createJobCard = (job) => {
        const matchScore = calculateMatchScore(job, preferences);
        const scoreBadgeClass = getScoreBadgeClass(matchScore);
        const currentStatus = jobStatuses[job.id]?.status || 'Not Applied';
        const statusBadgeClass = getStatusBadgeClass(currentStatus);

        const statusOptionsHTML = jobStatusOptions.map(opt => `<option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>`).join('');

        return `
            <div class="job-card" data-id="${job.id}">
                <div class="job-card-header">
                    <h3>${job.title}</h3>
                    <div class="job-card-badges">
                        ${arePreferencesSet() ? `<span class="score-badge ${scoreBadgeClass}">${matchScore}%</span>` : ''}
                        <span class="source-badge ${job.source.toLowerCase()}">${job.source}</span>
                    </div>
                </div>
                <p class="company">${job.company}</p>
                <p class="meta-info"><span>${job.location} (${job.mode})</span> | <span>${job.experience}</span></p>
                
                <div class="job-card-status">
                     <span class="status-badge ${statusBadgeClass}">${currentStatus}</span>
                     <select class="status-selector">${statusOptionsHTML}</select>
                </div>

                <div class="job-card-actions">
                    <button class="btn btn-secondary view-btn">View</button>
                    <a href="${job.applyUrl}" target="_blank" class="btn btn-primary apply-btn">Apply</a>
                </div>
            </div>
        `;
    };

    const createFilterBar = () => {
        const locations = [...new Set(jobs.map(j => j.location))];
        return `
            <div class="filter-bar">
                <input type="text" id="keyword-search" placeholder="Search...">
                <select id="location-filter"><option value="">All Locations</option>${locations.map(l => `<option value="${l}">${l}</option>`).join('')}</select>
                <select id="status-filter"><option value="">All Statuses</option>${jobStatusOptions.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
                <select id="sort-by"><option value="score">Sort: Match</option><option value="latest">Sort: Latest</option></select>
            </div>
            <div class="dashboard-controls"><label class="toggle-switch"><input type="checkbox" id="show-matches-toggle"><span class="slider"></span>Show jobs above threshold</label></div>
        `;
    };
    
    const generateDigest = () => {
        const todayKey = `jobTrackerDigest_${getTodayDateString()}`;
        const sortedJobs = [...jobs].map(job => ({ ...job, matchScore: calculateMatchScore(job, preferences) }))
            .sort((a, b) => b.matchScore - a.matchScore || a.postedDaysAgo - b.postedDaysAgo);
        const top10 = sortedJobs.slice(0, 10).filter(j => j.matchScore > 0);
        localStorage.setItem(todayKey, JSON.stringify(top10));
        return top10;
    };
    
    const createDigestHTML = (digestJobs) => {
        const recentStatusUpdates = Object.entries(jobStatuses)
            .sort((a, b) => new Date(b[1].date) - new Date(a[1].date))
            .slice(0, 5)
            .map(([jobId, statusInfo]) => {
                const job = jobs.find(j => j.id === parseInt(jobId));
                return job ? `<li><strong>${statusInfo.status}</strong>: ${job.title} at ${job.company} <span class="update-date">(${statusInfo.date})</span></li>` : '';
            }).join('');

        return `
            <div class="digest-container">
                <div class="digest-header"><h2>Top 10 Jobs For You</h2><p>${new Date().toLocaleDateString()}</p></div>
                ${digestJobs.map(job => `<div class="digest-job-item"><h4>${job.title}</h4><a href="${job.applyUrl}" target="_blank" class="btn btn-primary">Apply</a></div>`).join('')}
                ${recentStatusUpdates ? `<div class="digest-status-updates"><h3>Recent Status Updates</h3><ul>${recentStatusUpdates}</ul></div>` : ''}
            </div>`;
    };

    // --- ROUTER ---
    const routes = {
        '/': { title: 'Home', content: `<div class="hero-section"><h1>Stop Missing The Right Jobs.</h1><p>Precision-matched job discovery delivered daily at 9AM.</p><a href="#/settings" class="btn btn-primary">Start Tracking</a></div>` },
        '/dashboard': {
            title: 'Dashboard',
            onRender: () => {
                app.innerHTML = `<div class="page-content">
                        <h1>Dashboard</h1>
                        ${!arePreferencesSet() ? '<div class="banner"><a href="#/settings">Set your preferences</a> to activate intelligent matching.</div>' : ''}
                        ${createFilterBar()}
                        <div id="job-listing" class="job-grid"></div>
                    </div>`;

                const renderFn = () => {
                    let filteredJobs = [...jobs];
                    if (document.getElementById('show-matches-toggle').checked && arePreferencesSet()) {
                        filteredJobs = filteredJobs.filter(j => calculateMatchScore(j, preferences) >= preferences.minMatchScore);
                    }
                    const keyword = document.getElementById('keyword-search').value.toLowerCase();
                    if (keyword) filteredJobs = filteredJobs.filter(j => j.title.toLowerCase().includes(keyword) || j.company.toLowerCase().includes(keyword));
                    const statusFilter = document.getElementById('status-filter').value;
                    if (statusFilter) filteredJobs = filteredJobs.filter(j => (jobStatuses[j.id]?.status || 'Not Applied') === statusFilter);
                    const locationFilter = document.getElementById('location-filter').value;
                    if (locationFilter) filteredJobs = filteredJobs.filter(j => j.location === locationFilter);
                    const sortBy = document.getElementById('sort-by').value;
                    if (sortBy === 'score') filteredJobs.sort((a, b) => calculateMatchScore(b, preferences) - calculateMatchScore(a, preferences));
                    else filteredJobs.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
                    document.getElementById('job-listing').innerHTML = filteredJobs.length ? filteredJobs.map(createJobCard).join('') : `<div class="empty-state"><p>No roles match your criteria.</p></div>`;
                }
                renderFn();
                document.querySelectorAll('.filter-bar select, .filter-bar input, #show-matches-toggle').forEach(el => el.addEventListener('change', renderFn));
            }
        },
        '/settings': {
            title: 'Settings',
            onRender: () => {
                const locations = [...new Set(jobs.map(j => j.location))];
                app.innerHTML = `<div class="page-content"><h1>Settings</h1><div class="card">
                    <div class="form-group"><input type="text" id="roleKeywords" value="${preferences.roleKeywords.join(', ')}" placeholder="Role Keywords (e.g. backend, frontend)"></div>
                    <select id="preferredLocations" multiple size="5">${locations.map(l => `<option value="${l}" ${preferences.preferredLocations.includes(l) ? 'selected' : ''}>${l}</option>`).join('')}</select>
                    <div class="checkbox-group">${['Remote', 'Hybrid', 'Onsite'].map(m => `<label><input type="checkbox" name="preferredMode" value="${m}" ${preferences.preferredMode.includes(m) ? 'checked' : ''}> ${m}</label>`).join('')}</div>
                    <button id="save-prefs-btn" class="btn btn-primary">Save Preferences</button>
                </div></div>`;
                document.getElementById('save-prefs-btn').addEventListener('click', () => {
                    preferences = {
                        roleKeywords: document.getElementById('roleKeywords').value.split(',').map(s => s.trim()).filter(Boolean),
                        preferredLocations: Array.from(document.getElementById('preferredLocations').selectedOptions).map(opt => opt.value),
                        preferredMode: Array.from(document.querySelectorAll('input[name="preferredMode"]:checked')).map(cb => cb.value),
                        experienceLevel: preferences.experienceLevel, // Not in UI draft, retain from before
                        skills: preferences.skills, // Not in UI draft, retain from before
                        minMatchScore: preferences.minMatchScore, // Not in UI draft, retain from before
                    };
                    localStorage.setItem('jobTrackerPreferences', JSON.stringify(preferences));
                    alert('Preferences saved!');
                });
            }
        },
        '/digest': {
            title: 'Digest',
            onRender: () => {
                if (!arePreferencesSet()) {
                    app.innerHTML = `<div class="page-content"><h1>Daily Digest</h1><div class="empty-state"><p>Set your preferences to generate a personalized digest.</p></div></div>`;
                    return;
                }
                const todayKey = `jobTrackerDigest_${getTodayDateString()}`;
                const todaysDigest = localStorage.getItem(todayKey);
                if (todaysDigest) {
                    app.innerHTML = createDigestHTML(JSON.parse(todaysDigest));
                } else {
                    app.innerHTML = `<div class="page-content"><h1>Daily Digest</h1><div class="digest-init"><button id="generate-digest-btn" class="btn btn-primary">Generate Digest</button></div></div>`;
                    document.getElementById('generate-digest-btn').addEventListener('click', () => {
                        generateDigest();
                        routes['/digest'].onRender();
                    });
                }
            }
        },
        '/saved': {
            title: 'Saved',
            onRender: () => {
                app.innerHTML = `<div class="page-content"><h1>Saved Jobs</h1><div id="job-listing" class="job-grid"></div></div>`;
                const savedJobDetails = jobs.filter(job => savedJobs.includes(job.id));
                document.getElementById('job-listing').innerHTML = savedJobDetails.length ? savedJobDetails.map(createJobCard).join('') : `<div class="empty-state"><p>You haven't saved any jobs yet.</p></div>`;
            }
        },
        '/proof': { title: 'Proof', content: `<div class="page-content"><h1>Proof of Work</h1><p>Placeholder</p></div>` },
        '/jt/07-test': {
            title: 'Test Checklist',
            onRender: () => {
                const passedCount = testStatus.filter(v => v).length;
                const allPassed = passedCount === testItems.length;
                app.innerHTML = `
                    <div class="page-content">
                        <h1>Test Checklist</h1>
                        <div class="test-summary ${allPassed ? 'all-passed' : ''}">
                            <h2>Tests Passed: ${passedCount} / ${testItems.length}</h2>
                            ${!allPassed ? '<p class="warning-text">Resolve all issues before shipping.</p>' : '<p style="color: var(--color-success)">Ready to ship!</p>'}
                            <button id="reset-tests-btn" class="btn btn-secondary" style="margin-top: 10px;">Reset Test Status</button>
                        </div>
                        <div class="card checklist-container">
                            ${testItems.map((item, index) => `
                                <div class="checklist-item">
                                    <input type="checkbox" id="test-${index}" ${testStatus[index] ? 'checked' : ''}>
                                    <div>
                                        <label for="test-${index}">${item.label}</label>
                                        <span class="checklist-hint" title="${item.hint}">ⓘ How to test</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
                document.querySelectorAll('.checklist-item input').forEach((cb, index) => {
                    cb.addEventListener('change', (e) => {
                        testStatus[index] = e.target.checked;
                        localStorage.setItem('jobTrackerTestStatus', JSON.stringify(testStatus));
                        routes['/jt/07-test'].onRender();
                    });
                });
                document.getElementById('reset-tests-btn').addEventListener('click', () => {
                    testStatus = new Array(testItems.length).fill(false);
                    localStorage.setItem('jobTrackerTestStatus', JSON.stringify(testStatus));
                    routes['/jt/07-test'].onRender();
                });
            }
        },
        '/jt/08-ship': {
            title: 'Ship',
            onRender: () => {
                app.innerHTML = `<div class="page-content"><h1>Shipment Ready</h1><div class="card"><p>Congratulations! All tests passed. The application is ready for deployment.</p></div></div>`;
            }
        }
    };

    const render = (path) => {
        if (path === '/jt/08-ship' && testStatus.filter(v => v).length < testItems.length) {
            app.innerHTML = `<div class="page-content"><h1>Shipment Locked</h1><div class="card card--error"><p>Please complete all items in the <a href="#/jt/07-test">Test Checklist</a> before shipping.</p></div></div>`;
            updateActiveLink(path);
            return;
        }
        const route = routes[path] || routes['/'];
        document.title = `KodNest - ${route.title}`;
        if (route.onRender) route.onRender();
        else app.innerHTML = route.content;
        updateActiveLink(path);
    };

    const updateActiveLink = (path) => navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href').slice(1) === path));
    const router = () => render(window.location.hash.slice(1) || '/');
    
    // --- GLOBAL EVENT LISTENERS ---
    window.addEventListener('hashchange', router);
    window.addEventListener('load', router);

    app.addEventListener('change', e => {
        if(e.target.matches('.status-selector')) {
            const jobId = parseInt(e.target.closest('.job-card').dataset.id, 10);
            updateJobStatus(jobId, e.target.value);
        }
    });
});
