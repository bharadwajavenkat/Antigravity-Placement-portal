const StudentDashboardComponent = {
    props: ['showToast'],
    template: `
    <div class="dashboard-layout">
      <!-- Sidebar -->
      <nav class="sidebar">
        <div class="logo"><i class="bi bi-person-badge-fill"></i> Student Portal</div>
        <ul class="sidebar-nav">
          <li><button :class="['sidebar-nav-btn', tab==='drives' ? 'active':'']" @click="tab='drives';loadDrives()"><i class="bi bi-briefcase"></i>Browse Drives</button></li>
          <li><button :class="['sidebar-nav-btn', tab==='applications' ? 'active':'']" @click="tab='applications';loadApplications()"><i class="bi bi-file-text"></i>My Applications</button></li>
          <li><button :class="['sidebar-nav-btn', tab==='history' ? 'active':'']" @click="tab='history';loadHistory()"><i class="bi bi-clock-history"></i>History</button></li>
          <li><button :class="['sidebar-nav-btn', tab==='profile' ? 'active':'']" @click="tab='profile';loadProfile()"><i class="bi bi-person-gear"></i>My Profile</button></li>
          <li style="margin-top:auto;"><button class="sidebar-nav-btn" @click="logout"><i class="bi bi-box-arrow-left"></i>Logout</button></li>
        </ul>
      </nav>

      <main class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="page-title mb-0">Student Dashboard</h4>
          <span class="badge bg-primary">{{ studentName }}</span>
        </div>

        <!-- Browse Drives -->
        <div v-if="tab==='drives'">
          <div class="content-card mb-3">
            <div class="row g-2 align-items-center">
              <div class="col-md-8">
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input v-model="driveQ" @input="searchDrives" type="text" class="form-control" placeholder="Search by company or job title..." />
                </div>
              </div>
              <div class="col-md-4 d-flex gap-2">
                <button class="btn btn-outline-secondary btn-sm" @click="driveQ='';loadDrives()">Show All Eligible</button>
              </div>
            </div>
          </div>

          <div v-if="drives.length===0" class="text-center text-muted py-5">
            <i class="bi bi-inbox" style="font-size:3rem;opacity:.4;"></i>
            <p class="mt-2">No eligible drives available right now.</p>
          </div>
          <div v-for="d in drives" :key="d.id" class="drive-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <h6>{{ d.job_title }}</h6>
                <div class="meta"><i class="bi bi-building me-1"></i>{{ d.company_name }}</div>
                <div class="meta"><i class="bi bi-calendar me-1"></i>Deadline: {{ d.application_deadline }}</div>
                <div class="meta" v-if="d.eligibility_branch"><i class="bi bi-filter me-1"></i>Branch: {{ d.eligibility_branch }} | Min CGPA: {{ d.eligibility_cgpa }}</div>
                <p class="text-muted-sm mt-1" v-if="d.description">{{ d.description.slice(0,120) }}{{ d.description.length>120 ? '...' : '' }}</p>
              </div>
              <div>
                <span v-if="d.already_applied" class="badge badge-applied"><i class="bi bi-check me-1"></i>Applied</span>
                <button v-else class="btn btn-primary btn-sm" @click="apply(d.id)">
                  <i class="bi bi-send me-1"></i>Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- My Applications -->
        <div v-if="tab==='applications'">
          <div class="content-card">
            <h5>My Applications</h5>
            <div class="table-responsive">
              <table class="table table-clean table-hover">
                <thead><tr><th>Company</th><th>Job Title</th><th>Applied On</th><th>Status</th></tr></thead>
                <tbody>
                  <tr v-for="a in applications" :key="a.id">
                    <td>{{ a.company_name }}</td>
                    <td>{{ a.job_title }}</td>
                    <td>{{ a.application_date.slice(0,10) }}</td>
                    <td><span :class="'badge rounded-pill badge-' + a.status">{{ a.status }}</span></td>
                  </tr>
                  <tr v-if="applications.length===0"><td colspan="4" class="text-center text-muted">No applications yet</td></tr>
                </tbody>
              </table>
            </div>
            <button class="btn btn-outline-success btn-sm" @click="exportCSV"><i class="bi bi-download me-1"></i>Export CSV</button>
          </div>
        </div>

        <!-- History -->
        <div v-if="tab==='history'">
          <div class="content-card">
            <h5>Placement History</h5>
            <div class="table-responsive">
              <table class="table table-clean">
                <thead><tr><th>Company</th><th>Job Title</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  <tr v-for="(h, i) in history" :key="i">
                    <td>{{ h.company }}</td>
                    <td>{{ h.job_title }}</td>
                    <td><span :class="'badge rounded-pill badge-' + h.status">{{ h.status }}</span></td>
                    <td>{{ h.date.slice(0,10) }}</td>
                  </tr>
                  <tr v-if="history.length===0"><td colspan="4" class="text-center text-muted">No history</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Profile -->
        <div v-if="tab==='profile'">
          <div class="row g-3">
            <!-- Edit Profile -->
            <div class="col-md-6">
              <div class="content-card">
                <h5>Edit Profile</h5>
                <form @submit.prevent="saveProfile">
                  <div class="mb-2">
                    <label class="form-label">Branch</label>
                    <input v-model="profile.branch" type="text" class="form-control" />
                  </div>
                  <div class="mb-2">
                    <label class="form-label">CGPA</label>
                    <input v-model="profile.cgpa" type="number" step="0.01" min="0" max="10" class="form-control" />
                  </div>
                  <div class="mb-2">
                    <label class="form-label">Graduation Year</label>
                    <input v-model="profile.graduation_year" type="number" class="form-control" />
                  </div>
                  <div class="mb-2">
                    <label class="form-label">Phone</label>
                    <input v-model="profile.phone" type="text" class="form-control" />
                  </div>
                  <button type="submit" class="btn btn-primary btn-sm">Save Changes</button>
                </form>
              </div>
            </div>
            <!-- Resume Upload + Search -->
            <div class="col-md-6">
              <div class="content-card mb-3">
                <h5>Resume Upload</h5>
                <input type="file" id="resumeFile" class="form-control mb-2" accept=".pdf,.doc,.docx" />
                <button class="btn btn-outline-primary btn-sm" @click="uploadResume">
                  <i class="bi bi-upload me-1"></i>Upload Resume
                </button>
                <p class="text-muted-sm mt-2">Accepted: PDF, DOC, DOCX (max 10MB)</p>
              </div>
              <div class="content-card">
                <h5>Search Drives</h5>
                <div class="input-group mb-2">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input v-model="profileDriveQ" type="text" class="form-control" placeholder="Search drives..." @input="profileSearchDrives" />
                </div>
                <div v-for="d in profileDrives" :key="d.id" class="drive-card" style="border-left-color:#06b6d4;">
                  <h6 class="mb-0">{{ d.job_title }}</h6>
                  <div class="meta">{{ d.company_name }} | Deadline: {{ d.application_deadline }}</div>
                  <span v-if="d.already_applied" class="badge badge-applied">Applied</span>
                  <button v-else class="btn btn-sm btn-primary mt-1" @click="apply(d.id)">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  `,

    data() {
        return {
            tab: 'drives',
            studentName: localStorage.getItem('name') || 'Student',
            drives: [],
            driveQ: '',
            applications: [],
            history: [],
            profile: { branch: '', cgpa: '', graduation_year: '', phone: '' },
            profileDriveQ: '',
            profileDrives: []
        };
    },

    mounted() { this.loadDrives(); },

    methods: {
        logout() { localStorage.clear(); this.$router.push('/'); },

        async loadDrives() {
            const r = await axios.get('/api/student/drives');
            this.drives = r.data;
        },

        async searchDrives() {
            if (!this.driveQ.trim()) { this.loadDrives(); return; }
            const r = await axios.get('/api/student/search_drives', { params: { q: this.driveQ } });
            this.drives = r.data;
        },

        async apply(driveId) {
            try {
                await axios.post('/api/student/apply', { drive_id: driveId });
                this.showToast && this.showToast('Application submitted!');
                this.loadDrives();
            } catch (e) {
                this.showToast && this.showToast(e.response?.data?.error || 'Apply failed.', 'danger');
            }
        },

        async loadApplications() {
            const r = await axios.get('/api/student/applications');
            this.applications = r.data;
        },

        async loadHistory() {
            const r = await axios.get('/api/student/history');
            this.history = r.data;
        },

        async loadProfile() {
            // Profile data is not separate endpoint; show editable fields from token/localStorage
            // We'll load from drives endpoint which filters by profile
        },

        async saveProfile() {
            try {
                await axios.put('/api/student/profile', this.profile);
                this.showToast && this.showToast('Profile updated!');
            } catch (e) {
                this.showToast && this.showToast(e.response?.data?.error || 'Update failed.', 'danger');
            }
        },

        async uploadResume() {
            const fileInput = document.getElementById('resumeFile');
            if (!fileInput.files[0]) { this.showToast && this.showToast('Please select a file first.', 'warning'); return; }
            const fd = new FormData();
            fd.append('resume', fileInput.files[0]);
            try {
                await axios.post('/api/student/upload_resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                this.showToast && this.showToast('Resume uploaded successfully!');
                fileInput.value = '';
            } catch (e) {
                this.showToast && this.showToast(e.response?.data?.error || 'Upload failed.', 'danger');
            }
        },

        async exportCSV() {
            try {
                const r = await axios.get('/api/student/export_csv', { responseType: 'blob' });
                // Handle both sync blob download and async celery response
                const contentType = r.headers['content-type'] || '';
                if (contentType.includes('text/csv')) {
                    const url = window.URL.createObjectURL(new Blob([r.data]));
                    const a = document.createElement('a');
                    a.href = url; a.download = 'my_applications.csv'; a.click();
                } else {
                    // Celery async
                    const json = JSON.parse(await r.data.text());
                    this.showToast && this.showToast(json.message || 'CSV export triggered.');
                }
            } catch (e) {
                this.showToast && this.showToast('CSV export failed.', 'danger');
            }
        },

        async profileSearchDrives() {
            if (!this.profileDriveQ.trim()) { this.profileDrives = []; return; }
            const r = await axios.get('/api/student/search_drives', { params: { q: this.profileDriveQ } });
            this.profileDrives = r.data;
        }
    }
};
