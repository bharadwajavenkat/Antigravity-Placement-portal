const AdminDashboardComponent = {
    props: ['showToast'],
    template: `
    <div class="dashboard-layout">
      <!-- Sidebar -->
      <nav class="sidebar">
        <div class="logo"><i class="bi bi-mortarboard-fill"></i> Placement Portal</div>
        <ul class="sidebar-nav">
          <li><button :class="tab==='overview' ? 'active':''" @click="tab='overview'"><i class="bi bi-grid-1x2"></i>Overview</button></li>
          <li><button :class="tab==='companies' ? 'active':''" @click="tab='companies';loadCompanies()"><i class="bi bi-building"></i>Companies</button></li>
          <li><button :class="tab==='drives' ? 'active':''" @click="tab='drives';loadDrives()"><i class="bi bi-briefcase"></i>Drives</button></li>
          <li><button :class="tab==='students' ? 'active':''" @click="tab='students';loadStudents()"><i class="bi bi-people"></i>Students</button></li>
          <li><button :class="tab==='applications' ? 'active':''" @click="tab='applications';loadApplications()"><i class="bi bi-file-text"></i>Applications</button></li>
          <li style="margin-top:auto;"><button @click="logout"><i class="bi bi-box-arrow-left"></i>Logout</button></li>
        </ul>
      </nav>

      <!-- Main -->
      <main class="main-content">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="page-title mb-0">Admin Dashboard</h4>
          <span class="text-muted-sm">Welcome, {{ adminName }}</span>
        </div>

        <!-- Overview -->
        <div v-if="tab==='overview'">
          <div class="row g-3 mb-4">
            <div class="col-md-3 col-6" v-for="s in stats" :key="s.label">
              <div class="stat-card">
                <div class="icon-bg" :style="{background: s.color + '22', color: s.color}"><i :class="s.icon"></i></div>
                <div class="value">{{ s.value }}</div>
                <div class="label">{{ s.label }}</div>
              </div>
            </div>
          </div>
          <div class="row g-3" id="app-charts">
            <div class="col-md-7">
              <div class="content-card">
                <h5>Portal Overview</h5>
                <canvas id="barChart"></canvas>
              </div>
            </div>
            <div class="col-md-5">
              <div class="content-card">
                <h5>Application Status</h5>
                <canvas id="pieChart"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Companies -->
        <div v-if="tab==='companies'">
          <div class="content-card">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0">Companies</h5>
              <div class="input-group" style="max-width:260px;">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input v-model="companyQ" @input="searchCompanies" type="text" class="form-control" placeholder="Search..." />
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-clean table-hover">
                <thead><tr><th>Company</th><th>Email</th><th>Status</th><th>Active</th><th>Actions</th></tr></thead>
                <tbody>
                  <tr v-for="c in displayedCompanies" :key="c.id">
                    <td><strong>{{ c.company_name }}</strong><br><small class="text-muted">{{ c.name }}</small></td>
                    <td>{{ c.email }}</td>
                    <td><span :class="'badge rounded-pill badge-' + c.approval_status">{{ c.approval_status }}</span></td>
                    <td><span :class="c.is_active ? 'badge bg-success' : 'badge bg-secondary'">{{ c.is_active ? 'Active' : 'Blocked' }}</span></td>
                    <td>
                      <button v-if="c.approval_status==='pending'" class="btn btn-sm btn-success me-1" @click="approveCompany(c.id)">Approve</button>
                      <button v-if="c.approval_status==='pending'" class="btn btn-sm btn-danger me-1" @click="rejectCompany(c.id)">Reject</button>
                      <button class="btn btn-sm btn-outline-secondary" @click="toggleBlacklist(c.user_id, c.is_active)">{{ c.is_active ? 'Block' : 'Unblock' }}</button>
                    </td>
                  </tr>
                  <tr v-if="displayedCompanies.length===0"><td colspan="5" class="text-center text-muted">No companies found</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Drives -->
        <div v-if="tab==='drives'">
          <div class="content-card">
            <h5>Placement Drives</h5>
            <div class="table-responsive">
              <table class="table table-clean table-hover">
                <thead><tr><th>Title</th><th>Company</th><th>Deadline</th><th>Branch</th><th>Min CGPA</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  <tr v-for="d in drives" :key="d.id">
                    <td>{{ d.job_title }}</td>
                    <td>{{ d.company_name }}</td>
                    <td>{{ d.application_deadline }}</td>
                    <td>{{ d.eligibility_branch }}</td>
                    <td>{{ d.eligibility_cgpa }}</td>
                    <td><span :class="'badge rounded-pill badge-' + d.status">{{ d.status }}</span></td>
                    <td>
                      <button v-if="d.status==='pending'" class="btn btn-sm btn-success" @click="approveDrive(d.id)">Approve</button>
                    </td>
                  </tr>
                  <tr v-if="drives.length===0"><td colspan="7" class="text-center text-muted">No drives found</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Students -->
        <div v-if="tab==='students'">
          <div class="content-card">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0">Students</h5>
              <div class="input-group" style="max-width:260px;">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input v-model="studentQ" @input="searchStudents" type="text" class="form-control" placeholder="Search name/email/branch..." />
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-clean table-hover">
                <thead><tr><th>Name</th><th>Email</th><th>Branch</th><th>CGPA</th><th>Grad Year</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  <tr v-for="s in displayedStudents" :key="s.id">
                    <td>{{ s.name }}</td>
                    <td>{{ s.email }}</td>
                    <td>{{ s.branch }}</td>
                    <td>{{ s.cgpa }}</td>
                    <td>{{ s.graduation_year }}</td>
                    <td><span :class="s.is_active ? 'badge bg-success' : 'badge bg-secondary'">{{ s.is_active ? 'Active' : 'Blocked' }}</span></td>
                    <td><button class="btn btn-sm btn-outline-secondary" @click="toggleBlacklist(s.user_id, s.is_active)">{{ s.is_active ? 'Block' : 'Unblock' }}</button></td>
                  </tr>
                  <tr v-if="displayedStudents.length===0"><td colspan="7" class="text-center text-muted">No students found</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Applications -->
        <div v-if="tab==='applications'">
          <div class="content-card">
            <h5>All Applications</h5>
            <div class="table-responsive">
              <table class="table table-clean table-hover">
                <thead><tr><th>Student</th><th>Company</th><th>Drive</th><th>Status</th><th>Applied On</th></tr></thead>
                <tbody>
                  <tr v-for="a in applications" :key="a.id">
                    <td>{{ a.student_name }}<br><small class="text-muted">{{ a.student_email }}</small></td>
                    <td>{{ a.company_name }}</td>
                    <td>{{ a.job_title }}</td>
                    <td><span :class="'badge rounded-pill badge-' + a.status">{{ a.status }}</span></td>
                    <td>{{ a.application_date.slice(0,10) }}</td>
                  </tr>
                  <tr v-if="applications.length===0"><td colspan="5" class="text-center text-muted">No applications</td></tr>
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
            tab: 'overview',
            adminName: localStorage.getItem('name') || 'Admin',
            statsRaw: {},
            companies: [], displayedCompanies: [], companyQ: '',
            drives: [],
            students: [], displayedStudents: [], studentQ: '',
            applications: [],
            charts: {}
        };
    },

    mounted() {
        this.loadDashboard();
    },

    computed: {
        stats() {
            const d = this.statsRaw;
            return [
                { label: 'Students', value: d.students || 0, icon: 'bi bi-people-fill', color: '#4f46e5' },
                { label: 'Companies', value: d.companies || 0, icon: 'bi bi-building-fill', color: '#06b6d4' },
                { label: 'Drives', value: d.drives || 0, icon: 'bi bi-briefcase-fill', color: '#f59e0b' },
                { label: 'Applications', value: d.applications || 0, icon: 'bi bi-file-text-fill', color: '#10b981' },
                { label: 'Selected', value: d.selected || 0, icon: 'bi bi-trophy-fill', color: '#8b5cf6' },
                { label: 'Pending Companies', value: d.pending_companies || 0, icon: 'bi bi-hourglass-split', color: '#f97316' },
                { label: 'Pending Drives', value: d.pending_drives || 0, icon: 'bi bi-hourglass', color: '#ec4899' },
            ];
        }
    },

    methods: {
        logout() {
            localStorage.clear();
            this.$router.push('/');
        },

        async loadDashboard() {
            try {
                const r = await axios.get('/api/admin/dashboard');
                this.statsRaw = r.data;
                this.renderCharts();
            } catch (e) { console.error(e); }
        },

        renderCharts() {
            this.$nextTick(() => {
                const d = this.statsRaw;

                const barEl = document.getElementById('barChart');
                if (barEl) {
                    if (this.charts.bar) this.charts.bar.destroy();
                    this.charts.bar = new Chart(barEl, {
                        type: 'bar',
                        data: {
                            labels: ['Students', 'Companies', 'Drives', 'Applications', 'Selected'],
                            datasets: [{
                                data: [d.students, d.companies, d.drives, d.applications, d.selected],
                                backgroundColor: ['#4f46e5', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6'],
                                borderRadius: 6
                            }]
                        },
                        options: { plugins: { legend: { display: false } }, responsive: true }
                    });
                }
                const pieEl = document.getElementById('pieChart');
                if (pieEl) {
                    if (this.charts.pie) this.charts.pie.destroy();
                    const total = d.applications || 1;
                    const pending = total - (d.selected || 0);
                    this.charts.pie = new Chart(pieEl, {
                        type: 'doughnut',
                        data: {
                            labels: ['Other / Applied', 'Selected'],
                            datasets: [{
                                data: [pending, d.selected || 0],
                                backgroundColor: ['#e2e8f0', '#10b981'], borderWidth: 0
                            }]
                        },
                        options: { plugins: { legend: { position: 'bottom' } }, responsive: true, cutout: '65%' }
                    });
                }
            });
        },

        async loadCompanies() {
            const r = await axios.get('/api/admin/companies');
            this.companies = r.data;
            this.displayedCompanies = r.data;
        },
        async searchCompanies() {
            if (!this.companyQ.trim()) { this.displayedCompanies = this.companies; return; }
            const r = await axios.get('/api/admin/search_companies', { params: { q: this.companyQ } });
            this.displayedCompanies = r.data;
        },
        async approveCompany(id) {
            await axios.post('/api/admin/company/approve', { company_id: id });
            this.showToast && this.showToast('Company approved!');
            this.loadCompanies();
        },
        async rejectCompany(id) {
            await axios.post('/api/admin/company/reject', { company_id: id });
            this.showToast && this.showToast('Company rejected.', 'warning');
            this.loadCompanies();
        },
        async toggleBlacklist(userId, isActive) {
            await axios.post('/api/admin/blacklist', { user_id: userId });
            this.showToast && this.showToast(isActive ? 'User blocked.' : 'User unblocked.', isActive ? 'warning' : 'success');
            this.loadCompanies();
            if (this.tab === 'students') this.loadStudents();
        },

        async loadDrives() {
            const r = await axios.get('/api/admin/drives');
            this.drives = r.data;
        },
        async approveDrive(id) {
            await axios.post('/api/admin/drive/approve', { drive_id: id });
            this.showToast && this.showToast('Drive approved!');
            this.loadDrives();
        },

        async loadStudents() {
            const r = await axios.get('/api/admin/students');
            this.students = r.data;
            this.displayedStudents = r.data;
        },
        async searchStudents() {
            if (!this.studentQ.trim()) { this.displayedStudents = this.students; return; }
            const r = await axios.get('/api/admin/search_students', { params: { q: this.studentQ } });
            this.displayedStudents = r.data;
        },

        async loadApplications() {
            const r = await axios.get('/api/admin/applications');
            this.applications = r.data;
        }
    }
};
