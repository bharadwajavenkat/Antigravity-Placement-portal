const LoginComponent = {
    props: ['showToast'],
    template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="text-center mb-3">
          <i class="bi bi-mortarboard-fill" style="font-size:2.5rem;color:#4f46e5;"></i>
        </div>
        <h2 class="text-center">Placement Portal</h2>
        <p class="subtitle text-center">Sign in to your account</p>

        <form @submit.prevent="login">
          <div class="mb-3">
            <label class="form-label fw-500">Email address</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-envelope"></i></span>
              <input v-model="form.email" type="email" class="form-control" placeholder="you@institute.edu" required />
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label fw-500">Password</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-lock"></i></span>
              <input v-model="form.password" :type="showPass ? 'text' : 'password'" class="form-control" placeholder="Password" required />
              <button type="button" class="btn btn-outline-secondary" @click="showPass=!showPass">
                <i :class="showPass ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>

          <button type="submit" class="btn-primary-custom mt-2" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <p class="text-center mt-3 small">
          Don't have an account?
          <router-link to="/register" class="text-decoration-none fw-600" style="color:#4f46e5;">Register here</router-link>
        </p>

        <div class="mt-4 p-3 rounded-3" style="background:#f8fafc;">
          <p class="text-muted-sm fw-600 mb-1">Demo Credentials</p>
          <div class="text-muted-sm">Admin: admin@institute.edu / admin123</div>
        </div>
      </div>
    </div>
  `,
    data() {
        return { form: { email: '', password: '' }, error: '', loading: false, showPass: false };
    },
    methods: {
        async login() {
            this.error = '';
            this.loading = true;
            try {
                const res = await axios.post('/api/login', {
                    email: this.form.email.trim().toLowerCase(),
                    password: this.form.password
                });
                localStorage.setItem('token', res.data.access_token);
                localStorage.setItem('role', res.data.role);
                localStorage.setItem('name', res.data.name);
                localStorage.setItem('user_id', res.data.user_id);
                const roleRoutes = { admin: '/admin', company: '/company', student: '/student' };
                this.$router.push(roleRoutes[res.data.role] || '/');
            } catch (e) {
                this.error = e.response?.data?.error || 'Login failed. Please try again.';
            } finally {
                this.loading = false;
            }
        }
    }
};
