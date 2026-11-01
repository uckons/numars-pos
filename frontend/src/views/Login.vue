<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="logo-block" aria-hidden="true">
        <img
          v-if="showLogoImage"
          :src="logoUrl"
          alt="SKY POS Logo"
          class="logo-image"
          @error="showLogoImage = false"
        />
        <div v-else class="logo-circle">S</div>
      </div>
      <h1>SKY ePOS</h1>
      <p class="subtitle">Dibuat Khusus Untuk NUMARS </p>
      <p class="subtitle subtitle-login">Silahkan Login</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <input
          v-model="username"
          placeholder="Username"
          autocomplete="username"
        />

        <input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
        />

        <div class="captcha-box">
          <label>{{ captchaLabel }}</label>
          <div v-if="showCaptchaHost" ref="captchaEl" class="captcha-host"></div>
          <p v-else class="captcha-missing">
            Captcha belum dikonfigurasi. Set salah satu environment: <code>VITE_RECAPTCHA_SITE_KEY</code> atau
            <code>VITE_TURNSTILE_SITE_KEY</code>.
          </p>
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? "Loading..." : "Login" }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../store/auth.store"

const router = useRouter()
const auth = useAuthStore()

const username = ref("")
const password = ref("")
const loading = ref(false)
const error = ref("")

// Keep the default logo in /public so a clean build + rsync --delete cannot remove it.
const logoUrl = computed(() => import.meta.env.VITE_LOGIN_LOGO_URL || "/logo-sky.svg")
const showLogoImage = ref(true)

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ""
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""
const recaptchaMode = String(import.meta.env.VITE_RECAPTCHA_MODE || 'auto').toLowerCase()

const captchaProvider = computed(() => {
  if (recaptchaSiteKey) return "recaptcha"
  if (turnstileSiteKey) return "turnstile"
  return ""
})

const showCaptchaHost = computed(() => Boolean(captchaProvider.value))
const shouldUseRecaptchaExecute = computed(() => ['v3', 'execute'].includes(recaptchaMode))

const captchaLabel = computed(() => {
  if (captchaProvider.value === "recaptcha") return "Google reCAPTCHA"
  if (captchaProvider.value === "turnstile") return "Cloudflare Captcha"
  return "Captcha"
})

const captchaEl = ref(null)
const turnstileToken = ref("")
const recaptchaToken = ref("")
let turnstileWidgetId = null
let recaptchaWidgetId = null
const recaptchaUsesExecute = ref(false)

const waitFor = async (checkFn, timeoutMs = 7000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const value = checkFn()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return null
}

const loadTurnstileScript = () => new Promise((resolve, reject) => {
  const existingApi = window.turnstile
  if (existingApi && typeof existingApi.render === 'function') {
    resolve(existingApi)
    return
  }

  const existingScript = document.querySelector('script[data-turnstile="true"]')
  if (existingScript) {
    existingScript.addEventListener('load', async () => {
      const api = await waitFor(() => (window.turnstile && typeof window.turnstile.render === 'function' ? window.turnstile : null))
      if (api) resolve(api)
      else reject(new Error('Cloudflare Turnstile API tidak siap (render tidak tersedia)'))
    })
    existingScript.addEventListener('error', () => reject(new Error('Gagal memuat Cloudflare Turnstile')))
    return
  }

  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.dataset.turnstile = 'true'
  script.onload = async () => {
    const api = await waitFor(() => (window.turnstile && typeof window.turnstile.render === 'function' ? window.turnstile : null))
    if (api) resolve(api)
    else reject(new Error('Cloudflare Turnstile API tidak siap (render tidak tersedia)'))
  }
  script.onerror = () => reject(new Error('Gagal memuat Cloudflare Turnstile'))
  document.head.appendChild(script)
})

const getRecaptchaEnterpriseApi = () => {
  const enterprise = window.grecaptcha?.enterprise
  if (!enterprise) return null
  if (typeof enterprise.render === 'function' || typeof enterprise.execute === 'function') return enterprise
  return null
}

const loadRecaptchaScript = () => new Promise(async (resolve, reject) => {
  const existingApi = getRecaptchaEnterpriseApi()
  if (existingApi) {
    resolve(existingApi)
    return
  }

  const waitApi = async () => waitFor(getRecaptchaEnterpriseApi)

  const tryInject = (src, tag) => new Promise((res, rej) => {
    const prev = document.querySelector(`script[data-recaptcha="${tag}"]`)
    if (prev) {
      prev.addEventListener('load', () => res(true), { once: true })
      prev.addEventListener('error', () => rej(new Error(`Gagal memuat Google reCAPTCHA Enterprise (${tag})`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.dataset.recaptcha = tag
    script.onload = () => res(true)
    script.onerror = () => rej(new Error(`Gagal memuat Google reCAPTCHA Enterprise (${tag})`))
    document.head.appendChild(script)
  })

  const candidates = [
    { tag: 'enterprise-keyed', src: `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(recaptchaSiteKey || '')}` },
    { tag: 'enterprise-explicit', src: 'https://www.google.com/recaptcha/enterprise.js?render=explicit' }
  ]

  const errors = []
  for (const candidate of candidates) {
    try {
      await tryInject(candidate.src, candidate.tag)
      const api = await waitApi()
      if (api) {
        resolve(api)
        return
      }
      errors.push(`API enterprise tidak siap (${candidate.tag})`)
    } catch (err) {
      errors.push(err?.message || String(err))
    }
  }

  reject(new Error(`Google reCAPTCHA Enterprise gagal dimuat. Cek Enterprise site key/domain/restriction. Detail: ${errors.join(' | ')}`))
})

const renderTurnstile = async () => {
  if (!turnstileSiteKey || !captchaEl.value) return
  try {
    const turnstile = await loadTurnstileScript()
    captchaEl.value.innerHTML = ''
    turnstileWidgetId = turnstile.render(captchaEl.value, {
      sitekey: turnstileSiteKey,
      theme: 'dark',
      callback: (token) => {
        turnstileToken.value = token
      },
      'expired-callback': () => {
        turnstileToken.value = ''
      },
      'error-callback': () => {
        turnstileToken.value = ''
      }
    })
  } catch (e) {
    error.value = e.message || 'Captcha Cloudflare gagal dimuat'
  }
}

const showRecaptchaExecuteInfo = () => {
  if (!captchaEl.value) return
  captchaEl.value.innerHTML = '<small class="captcha-missing">Google reCAPTCHA execute/enterprise aktif. Token dibuat saat Login.</small>'
}

const renderRecaptcha = async () => {
  if (!recaptchaSiteKey || !captchaEl.value) return
  try {
    const recaptchaEnterprise = await loadRecaptchaScript()
    captchaEl.value.innerHTML = ''

    if (shouldUseRecaptchaExecute.value && typeof recaptchaEnterprise.execute === 'function') {
      recaptchaUsesExecute.value = true
      showRecaptchaExecuteInfo()
      return
    }

    if (typeof recaptchaEnterprise.render === 'function') {
      recaptchaUsesExecute.value = false
      try {
        recaptchaWidgetId = recaptchaEnterprise.render(captchaEl.value, {
          sitekey: recaptchaSiteKey,
          theme: 'dark',
          callback: (token) => {
            recaptchaToken.value = token
          },
          'expired-callback': () => {
            recaptchaToken.value = ''
          },
          'error-callback': () => {
            recaptchaToken.value = ''
          }
        })
        return
      } catch (renderErr) {
        const message = String(renderErr?.message || renderErr || '')
        if ((message.toLowerCase().includes('invalid key type') || message.toLowerCase().includes('invalid site key')) && typeof recaptchaEnterprise.execute === 'function') {
          recaptchaUsesExecute.value = true
          showRecaptchaExecuteInfo()
          return
        }
        throw renderErr
      }
    }

    if (typeof recaptchaEnterprise.execute === 'function') {
      recaptchaUsesExecute.value = true
      showRecaptchaExecuteInfo()
      return
    }

    throw new Error('Google reCAPTCHA API tidak mendukung render/execute')
  } catch (e) {
    error.value = e.message || 'Google reCAPTCHA gagal dimuat'
  }
}

const renderCaptcha = async () => {
  if (captchaProvider.value === 'recaptcha') {
    await renderRecaptcha()
    return
  }
  if (captchaProvider.value === 'turnstile') {
    await renderTurnstile()
  }
}

const requestAppFullscreen = async () => {
  const el = document.documentElement
  if (!el || document.fullscreenElement) return
  try {
    if (el.requestFullscreen) await el.requestFullscreen()
  } catch (_) {
    // Browser may block fullscreen without a direct trusted user gesture.
  }
}

const ensureRecaptchaToken = async () => {
  if (!recaptchaUsesExecute.value) return recaptchaToken.value

  const recaptchaEnterpriseApi = window.grecaptcha?.enterprise

  if (!recaptchaEnterpriseApi || typeof recaptchaEnterpriseApi.execute !== 'function') {
    throw new Error('Google reCAPTCHA Enterprise execute tidak tersedia')
  }

  if (typeof recaptchaEnterpriseApi.ready === 'function') {
    await new Promise((resolve) => recaptchaEnterpriseApi.ready(resolve))
  }

  try {
    const token = await recaptchaEnterpriseApi.execute(recaptchaSiteKey, { action: 'login' })
    recaptchaToken.value = token || ''
    return recaptchaToken.value
  } catch (err) {
    const msg = String(err?.message || err || '')
    if (msg.toLowerCase().includes('invalid site key')) {
      throw new Error(`Invalid site key reCAPTCHA Enterprise: ${recaptchaSiteKey}`)
    }
    throw err
  }
}

const handleLogin = async () => {
  if (captchaProvider.value === 'turnstile' && !turnstileToken.value) {
    error.value = 'Captcha Cloudflare belum tervalidasi'
    return
  }

  loading.value = true
  error.value = ""
  try {
    if (captchaProvider.value === 'recaptcha') {
      await ensureRecaptchaToken()
      if (!recaptchaToken.value) {
        error.value = 'Google reCAPTCHA belum tervalidasi'
        loading.value = false
        return
      }
    }

    await auth.login(username.value, password.value, {
      turnstileToken: turnstileToken.value,
      recaptchaToken: recaptchaToken.value
    })
    await requestAppFullscreen()
    const role = auth.role
    if (role === "SuperAdmin") router.push("/superadmin")
    else if (role === "Owner") router.push("/owner")
    else if (role === "Manager") router.push("/manager")
    else if (role === "Supervisor") router.push("/supervisor")
    else if (role === "Staff Bar") router.push("/bar")
    else if (role === "Kasir") router.push("/kasir")
    else if (role === "Terapis") router.push("/terapis")
    else router.push("/login")
  } catch (e) {
    const baseMessage = e.response?.data?.message || e.message || "Login gagal"
    const details = Array.isArray(e.response?.data?.errors) ? e.response.data.errors.filter(Boolean) : []
    error.value = details.length ? `${baseMessage} (${details.join(", ")})` : baseMessage
  } finally {
    loading.value = false
    if (captchaProvider.value === 'turnstile' && window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId)
      turnstileToken.value = ''
    }
    if (captchaProvider.value === 'recaptcha' && !recaptchaUsesExecute.value && window.grecaptcha?.enterprise && recaptchaWidgetId !== null) {
      window.grecaptcha.enterprise.reset(recaptchaWidgetId)
      recaptchaToken.value = ''
    }
  }
}

onMounted(renderCaptcha)
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  background: #0e0e0e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: min(460px, 92vw);
  background: #111;
  border: 1px solid #c9a24d;
  padding: 24px;
  text-align: center;
}

.logo-block {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.logo-image {
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: 88px;
  object-fit: contain;
  box-shadow: 0 0 14px rgba(201, 162, 77, 0.2);
}

.logo-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid #c9a24d;
  color: #c9a24d;
  font-weight: 800;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #171717, #090909);
  box-shadow: 0 0 14px rgba(201, 162, 77, 0.2);
}

h1 {
  color: #c9a24d;
  margin-bottom: 4px;
}

.subtitle {
  color: #aaa;
  margin-bottom: 4px;
}

.subtitle-login {
  margin-bottom: 14px;
  color: #8d8d8d;
  font-size: 13px;
}

.login-form {
  width: 100%;
}

.captcha-box {
  text-align: left;
  margin-bottom: 12px;
}

.captcha-box label {
  display: block;
  color: #b8b8b8;
  font-size: 12px;
  margin-bottom: 6px;
}

.captcha-host {
  min-height: 70px;
  display: flex;
  align-items: center;
}

.captcha-missing {
  color: #e5c677;
  font-size: 12px;
  margin: 0;
}

input {
  width: 100%;
  margin-bottom: 12px;
  padding: 10px;
  background: #000;
  border: 1px solid #333;
  color: #fff;
}

button {
  width: 100%;
  padding: 10px;
  background: #c9a24d;
  border: none;
  font-weight: bold;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #ff6b6b;
  margin-top: 12px;
  font-size: 13px;
}
</style>
