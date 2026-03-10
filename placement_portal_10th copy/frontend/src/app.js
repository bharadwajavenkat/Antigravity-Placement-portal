// ─── Axios defaults ─────────────────────────────────────────────────────────
axios.defaults.baseURL = window.location.origin;
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axios.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// ─── Router ──────────────────────────────────────────────────────────────────
const routes = [
  { path: '/',          component: LoginComponent },
  { path: '/register',  component: RegisterComponent },
  { path: '/admin',     component: AdminDashboardComponent,   meta: { role: 'admin' } },
  { path: '/company',   component: CompanyDashboardComponent, meta: { role: 'company' } },
  { path: '/student',   component: StudentDashboardComponent, meta: { role: 'student' } },
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('role');
  if (to.meta.role) {
    if (!token) return next('/');
    if (to.meta.role !== role) return next('/');
  }
  next();
});

// ─── Root App ───────────────────────────────────────────────────────────────
const App = {
  template: `
    <div>
      <div v-if="toast.show" :class="'alert alert-' + toast.type + ' alert-floating d-flex align-items-center gap-2'">
        <i :class="toast.type === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill'"></i>
        <span>{{ toast.msg }}</span>
      </div>
      <router-view :show-toast="showToast"></router-view>
    </div>
  `,
  data() {
    return {
      toast: { show: false, msg: '', type: 'success' }
    };
  },
  methods: {
    showToast(msg, type = 'success') {
      this.toast = { show: true, msg, type };
      setTimeout(() => { this.toast.show = false; }, 3500);
    }
  }
};

// ─── Mount ───────────────────────────────────────────────────────────────────
const app = Vue.createApp(App);
app.use(router);
app.mount('#app');
