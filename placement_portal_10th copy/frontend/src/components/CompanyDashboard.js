const CompanyDashboardComponent = {
    props: ['showToast'],
    template: `
    <div class="dashboard-layout">
      <!-- Sidebar -->
      <nav class="sidebar">
        <div class="logo"><i class="bi bi-building-fill"></i> Company Portal</div>
        <ul class="sidebar-nav">
          <li><button :class="['sidebar-nav-btn', tab==='drives' ? 'active':'']" @click="tab='drives';loadDrives()"><i class="bi bi-briefcase"></i>My Drives</button></li>
          <li><button :class="['sidebar-nav-btn', tab==='create' ? 'active':'']" @click="tab='create'"><i class="bi bi-plus-circle"></i>Post Drive</button></li>
          <li><button :class="['sidebar-nav-btn', tab==='applicants' ? 'active':'']" @click="tab='applicants';loadApplications()"><i class="bi bi-people"></i>Applicants</button></li>
          <li style="margin-top:auto;"><button class="sidebar-nav-btn" @click="logout"><i class="bi bi-box-arrow-left"></i>Logout</button></li>
        </ul>
      </nav>

      <main class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="page-title mb-0">Company Dashboard</h4>
          <span class="badge bg-primary">{{ companyName }}</span>
        </div>

        <!-- My Drives -->
        <div v-if="tab==='drives'">
          <div class="content-card">
            <h5>Your Placement Drives</h5>
            <div v-if="drives.length===0" class="text-center text-muted py-4">
              <i class="bi bi-inbox" style="font-size:2rem;"></i><br>No drives yet. Post one!
            </div>
            <div v-for="d in drives" :key="d.id" class="drive-card">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6>{{ d.job_title }}</h6>
                  <div class="meta"><i class="bi bi-calendar me-1"></i>Deadline: {{ d.application_deadline }}</div>
                  <div class="meta"><i class="bi bi-people me-1"></i>{{ d.applications_count }} Applications</div>
                  <div class="meta" v-if="d.eligibility_branch"><i class="bi bi-filter me-1"></i>Branch: {{ d.eligibility_branch }} | Min CGPA: {{ d.eligibility_cgpa }}</div>
                </div>
                <span :class="'badge rounded-pill badge-' + d.status + ' ms-2'">{{ d.status }}</span>
              </div>
              <p class="mt-2 text-muted-sm" v-if="d.description">{{ d.description }}</p>
            </div>
          </div>
        </div>

        <!-- Create Drive -->
        <div v-if="tab==='create'">
          <div class="content-card" style="max-width:640px;">
            <h5>Post a New Placement Drive</h5>
            <form @submit.prevent="createDrive">
              <div class="mb-3">
                <label class="form-label">Job Title <span class="text-danger">*</span></label>
                <input v-model="form.job_title" type="text" class="form-control" placeholder="e.g. Software Engineer" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea v-model="form.description" class="form-control" rows="3" placeholder="Job description, responsibilities..."></textarea>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-4">
                  <label class="form-label">Eligible Branch</label>
                  <input v-model="form.eligibility_branch" type="text" class="form-control" placeholder="CSE,ECE or ALL" />
                </div>
                <div class="col-md-4">
                  <label class="form-label">Min CGPA</label>
                  <input v-model="form.eligibility_cgpa" type="number" step="0.1" min="0" max="10" class="form-control" placeholder="0.0" />
                </div>
                <div class="col-md-4">
                  <label class="form-label">Graduation Year</label>
                  <input v-model="form.eligibility_year" type="number" class="form-control" placeholder="e.g. 2025" />
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Application Deadline <span class="text-danger">*</span></label>
                <input v-model="form.application_deadline" type="date" class="form-control" required />
              </div>
              <div v-if="createError" class="alert alert-danger py-2 small">{{ createError }}</div>
              <button type="submit" class="btn btn-primary" :disabled="createLoading">
                <span v-if="createLoading" class="spinner-border spinner-border-sm me-1"></span>
                Post Drive
              </button>
            </form>
          </div>
        </div>

        <!-- Applicants -->
        <div v-if="tab==='applicants'">
          <div class="content-card">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0">Applicants</h5>
              <select v-model="selectedDriveId" @change="filterApplications" class="form-select" style="max-width:220px;">
                <option value="">All Drives</option>
                <option v-for="d in drives" :key="d.id" :value="d.id">{{ d.job_title }}</option>
              </select>
            </div>
            <div class="table-responsive">
              <table class="table table-clean table-hover">
                <thead><tr><th>Student</th><th>Branch</th><th>CGPA</th><th>Drive</th><th>Status</th><th>Update</th></tr></thead>
                <tbody>
                  <tr v-for="a in filteredApplications" :key="a.id">
                    <td>{{ a.student_name }}<br><small class="text-muted">{{ a.student_email }}</small></td>
                    <td>{{ a.branch }}</td>
                    <td>{{ a.cgpa }}</td>
                    <td>{{ a.job_title }}</td>
                    <td><span :class="'badge rounded-pill badge-' + a.status">{{ a.status }}</span></td>
                    <td>
                      <select @change="updateStatus(a.id, $event.target.value)" :value="a.status" class="form-select form-select-sm" style="width:130px;">
                        <option value="applied">applied</option>
                        <option value="shortlisted">shortlisted</option>
                        <option value="selected">selected</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </td>
                  </tr>
                  <tr v-if="filteredApplications.length===0"><td colspan="6" class="text-center text-muted">No applicants</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  `,

    data() {
        return {
            tab: 'drives',
            companyName: localStorage.getItem('name') || 'Company',
            drives: [],
            applications: [],
            filteredApplications: [],
            selectedDriveId: '',
            form: { job_title: '', description: '', eligibility_branch: 'ALL', eligibility_cgpa: 0, eligibility_year: '', application_deadline: '' },
            createError: '',
            createLoading: false
        };
    },

    mounted() { this.loadDrives(); },

    methods: {
        logout() { localStorage.clear(); this.$router.push('/'); },

        async loadDrives() {
            const r = await axios.get('/api/company/drives');
            this.drives = r.data;
        },

        async createDrive() {
            this.createError = ''; this.createLoading = true;
            try {
                await axios.post('/api/company/create_drive', this.form);
                this.showToast && this.showToast('Drive posted! Awaiting admin approval.');
                this.tab = 'drives';
                this.loadDrives();
                this.form = { job_title: '', description: '', eligibility_branch: 'ALL', eligibility_cgpa: 0, eligibility_year: '', application_deadline: '' };
            } catch (e) {
                this.createError = e.response?.data?.error || 'Failed to create drive.';
            } finally { this.createLoading = false; }
        },

        async loadApplications() {
            const r = await axios.get('/api/company/applications');
            this.applications = r.data;
            this.filteredApplications = r.data;
        },

        filterApplications() {
            if (!this.selectedDriveId) { this.filteredApplications = this.applications; return; }
            this.filteredApplications = this.applications.filter(a => a.drive_id == this.selectedDriveId);
        },

        async updateStatus(appId, status) {
            await axios.post('/api/company/update_application_status', { application_id: appId, status });
            this.showToast && this.showToast(`Status updated to ${status}`);
            this.loadApplications();
        }
    }
};
