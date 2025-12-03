// ========== KONFIG SUPABASE ==========
const SUPABASE_URL = 'https://jllomycpshgbhppipyaj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbG9teWNwc2hnYmhwcGlweWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzg2OTcsImV4cCI6MjA3NTg1NDY5N30.DQYcB25G6blGpQnxyLlaqsX8OTXWMc7q51EtJN35vY4';
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ====================================

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const goApp   = () => location.href = 'index.html';
const goLogin = () => location.href = 'login.html';

function switchPane(name){
  $$('.pane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== name));
}

/* Prefill email jika remember me tersimpan */
function initRemember(){
  const saved = localStorage.getItem('keude_last_email');
  if(saved) $('#formLogin [name="email"]').value = saved;
}

/* Cek sesi: bila sudah login, langsung ke app */
async function checkSession(){
  try{
    const { data:{ session } } = await supa.auth.getSession();
    if(session) goApp();
  }catch{}
  // Auto-redirect juga saat status auth berubah
  supa.auth.onAuthStateChange((_e, session)=>{
    if(session) goApp();
  });
}

/* Login (email + password) */
function bindLogin(){
  $('#formLogin')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email');
    const password = fd.get('password');
    try{
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if(error) throw error;
      if($('#rememberMe')?.checked) localStorage.setItem('keude_last_email', email);
      goApp();
    }catch(err){
      alert('Login gagal: ' + err.message);
    }
  });
}

/* Sign up → kirim verifikasi ke callback.html (hindari 404) */
function bindSignup(){
  $('#formSignup')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email');
    const password = fd.get('password');
    const p2 = fd.get('password2');
    if(password !== p2) return alert('Konfirmasi password tidak sama.');

    try{
      const { error } = await supa.auth.signUp({
        email, password,
        options:{
          data:{ first_name: fd.get('first_name'), last_name: fd.get('last_name') },
          // <<< PENTING: arahkan ke callback.html >>>
          emailRedirectTo: `${location.origin}/callback.html`
        }
      });
      if(error) throw error;
      alert('Sign up berhasil. Cek email kamu untuk verifikasi.');
      switchPane('login');
    }catch(err){
      alert('Sign up gagal: ' + err.message);
    }
  });
}

/* Forgot password → juga pakai callback.html */
function bindForgot(){
  $('#linkForgot')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const email = $('#formLogin [name="email"]').value || prompt('Masukkan email Anda:');
    if(!email) return;
    try{
      const { error } = await supa.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/callback.html`
      });
      if(error) throw error;
      alert('Link reset password telah dikirim ke email.');
    }catch(err){
      alert('Gagal mengirim reset password: ' + err.message);
    }
  });
}

/* OAuth → redirect ke callback.html biar tidak 404 */
function bindOAuth(){
  $('#btnOAuthGoogle')?.addEventListener('click', ()=>{
    supa.auth.signInWithOAuth({
      provider:'google',
      options:{ redirectTo: `${location.origin}/callback.html` }
    });
  });
  $('#btnOAuthGithub')?.addEventListener('click', ()=>{
    supa.auth.signInWithOAuth({
      provider:'github',
      options:{ redirectTo: `${location.origin}/callback.html` }
    });
  });
}

/* Switch link login <-> signup */
function bindSwitch(){
  $$('[data-switch]').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      switchPane(a.dataset.switch);
    });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  initRemember();
  bindLogin();
  bindSignup();
  bindForgot();
  bindOAuth();
  bindSwitch();
  checkSession();
});
