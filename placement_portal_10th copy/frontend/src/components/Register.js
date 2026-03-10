const RegisterComponent = {
    props: ['showToast'],
    template: `
    <div class="auth-wrapper">
      <div class="auth-card" style="max-width:520px;">
        <div class="text-center mb-3">
          <i class="bi bi-person-plus-fill" style="font-size:2.2rem;color:#4f46e5;"></i>
        </div>
        <h2 class="text-center">Create Account</h2>
        <p class="subtitle text-center">Join the Placement Portal</p>

        <!-- Tab Switch -->
        <ul class="nav nav-pills mb-4 justify-content-center gap-2">
          <li class="nav-item">
            <button :class="['nav-link', tab==='student' ? 'active' : '']" @click="tab='student'">
              <i class="bi bi-person-circle me-1"></i>Student
            </button>
          </li>
          <li class="nav-item">
            <button :class="['nav-link', tab==='company' ? 'active' : '']" @click="tab='company'">
              <i class="bi bi-building me-1"></i>Company
            </button>
          </li>
        </ul>

        <!-- Student Form -->
        <form v-if="tab==='student'" @submit.prevent="registerStudent">
          <div class="row g-2">
            <div class="col-12">
              <input v-model="s.name" type="text" class="form-control" placeholder="Full Name" required />
            </div>
            <div class="col-12">
              <input v-model="s.email" type="email" class="form-control" placeholder="Email address" required />
            </div>
            <div class="col-12">
              <input v-model="s.password" type="password" class="form-control" placeholder="Password" required />
            </div>
            <div class="col-md-6">
              <input v-model="s.branch" type="text" class="form-control" placeholder="Branch (e.g. CSE)" required />
            </div>
            <div class="col-md-3">
              <input v-model="s.cgpa" type="number" step="0.01" min="0" max="10" class="form-control" placeholder="CGPA" required />
            </div>
            <div class="col-md-3">
              <input v-model="s.graduation_year" type="number" class="form-control" placeholder="Grad Year" required />
            </div>
            <div class="col-12">
              <input v-model="s.phone" type="text" class="form-control" placeholder="Phone (optional)" />
            </div>
          </div>
          <div v-if="error" class="alert alert-danger py-2 small mt-2">{{ error }}</div>
          <button type="submit" class="btn-primary-custom mt-3" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
            {{ loading ? 'Registering...' : 'Register as Student' }}
          </button>
        </form>

        <!-- Company Form -->
        <form v-if="tab==='company'" @submit.prevent="registerCompany">
          <div class="row g-2">
            <div class="col-12">
              <input v-model="c.name" type="text" class="form-control" placeholder="Your Full Name" required />
            </div>
            <div class="col-12">
              <input v-model="c.email" type="email" class="form-control" placeholder="Work Email" required />
            </div>
            <div class="col-12">
              <input v-model="c.password" type="password" class="form-control" placeholder="Password" required />
            </div>
            <div class="col-12">
              <input v-model="c.company_name" type="text" class="form-control" placeholder="Company Name" required />
            </div>
            <div class="col-md-6">
              <input v-model="c.hr_contact" type="text" class="form-control" placeholder="HR Contact Email" />
            </div>
            <div class="col-md-6">
              <input v-model="c.website" type="url" class="form-control" placeholder="Website URL" />
            </div>
          </div>
          <div class="alert alert-info py-2 small mt-2">
            <i class="bi bi-info-circle me-1"></i>
            Your account will be reviewed and approved by the admin before login.
          </div>
          <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
          <button type="submit" class="btn-primary-custom" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
            {{ loading ? 'Registering...' : 'Register as Company' }}
          </button>
        </form>

        <p class="text-center mt-3 small">
          Already have an account?
          <router-link to="/" class="text-decoration-none fw-600" style="color:#4f46e5;">Sign in</router-link>
        </p>
      </div>
    </div>
  `,
    data() {
        return {
            tab: 'student',
            error: '',
            loading: false,
            s: { name: '', email: '', password: '', branch: '', cgpa: '', graduation_year: '', phone: '' },
            c: { name: '', email: '', password: '', company_name: '', hr_contact: '', website: '' }
        };
    },
    methods: {
        async registerStudent() {
            this.error = ''; this.loading = true;
            try {
                await axios.post('/api/register/student', this.s);
                this.$router.push('/');
                this.showToast && this.showToast('Registered successfully! Please log in.', 'success');
            } catch (e) {
                this.error = e.response?.data?.error || 'Registration failed.';
            } finally { this.loading = false; }
        },
        async registerCompany() {
            this.error = ''; this.loading = true;
            try {
                await axios.post('/api/register/company', this.c);
                this.$router.push('/');
                this.showToast && this.showToast('Registered! Await admin approval before logging in.', 'success');
            } catch (e) {
                this.error = e.response?.data?.error || 'Registration failed.';
            } finally { this.loading = false; }
        }
    }
};
