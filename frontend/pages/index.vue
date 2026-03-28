<template>
  <div class="app">
    <!-- ───────────────────────── Header ─────────────────────────────────── -->
    <header class="app-header no-print">
      <h1 class="app-title">🌞 SemesterApp</h1>

      <div class="header-controls">
        <!-- Year selector -->
        <div class="control-group">
          <label for="year-select">År</label>
          <select id="year-select" v-model="year" @change="loadRequests">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <!-- Add person -->
        <div class="control-group add-person-group">
          <input
            v-model="newName"
            class="add-person-input"
            type="text"
            placeholder="Ny persons namn…"
            maxlength="100"
            @keyup.enter="addEmployee"
          />
          <button class="btn-add" :disabled="!newName.trim() || addingEmployee" @click="addEmployee">
            ➕ Lägg till
          </button>
        </div>

        <!-- Print -->
        <button class="btn-print no-print" @click="printPage">🖨 Skriv ut</button>
      </div>
    </header>

    <!-- ───────────────────────── Months ─────────────────────────────────── -->
    <main class="months-container">
      <div v-if="loadingEmployees" class="loading-state">Laddar…</div>

      <template v-else>
        <div
          v-for="md in monthsData"
          :key="md.monthNum"
          class="month-block"
        >
          <!-- Month header -->
          <div class="month-header">
            <span class="month-icon">{{ md.icon }}</span>
            <h2 class="month-name">{{ md.monthName }}</h2>
            <span class="month-year">{{ year }}</span>
          </div>

          <!-- Table -->
          <div class="table-wrap">
            <table class="calendar-table">
              <thead>
                <!-- Row 1: Week numbers -->
                <tr class="week-row">
                  <th class="sticky-col week-name-cell">Namn</th>
                  <th
                    v-for="wg in md.weekGroups"
                    :key="wg.isoWeek"
                    :colspan="wg.days.length"
                    class="week-cell"
                  >V.{{ wg.isoWeek }}</th>
                </tr>

                <!-- Row 2: Day abbreviations -->
                <tr class="abbr-row">
                  <th class="sticky-col abbr-name-cell"></th>
                  <th
                    v-for="day in md.days"
                    :key="day.dateStr"
                    :class="['abbr-cell', { weekend: day.isWeekend, holiday: day.isHoliday }]"
                  >{{ day.dayAbbr }}</th>
                </tr>

                <!-- Row 3: Day numbers -->
                <tr class="num-row">
                  <th class="sticky-col num-name-cell"></th>
                  <th
                    v-for="day in md.days"
                    :key="day.dateStr"
                    :class="['num-cell', { weekend: day.isWeekend, holiday: day.isHoliday }]"
                  >{{ day.dayOfMonth }}</th>
                </tr>

                <!-- Row 4: Holiday names (only if month has red days) -->
                <tr v-if="md.hasHolidays" class="hnames-row">
                  <th class="sticky-col hnames-label-cell">🔴</th>
                  <th
                    v-for="day in md.days"
                    :key="day.dateStr"
                    class="hname-cell"
                  >{{ day.isHoliday ? (md.holidayNames.get(day.dateStr) ?? '') : '' }}</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(emp, idx) in employees"
                  :key="emp.id"
                  class="emp-row"
                >
                  <!-- Sticky name cell with inline edit -->
                  <td class="sticky-col emp-name-cell">
                    <div class="name-cell-inner">
                      <span class="color-dot" :style="{ background: empColor(idx) }"></span>
                      <input
                        v-model="editNames[emp.id]"
                        class="name-input"
                        :class="{ error: nameErrors[emp.id] }"
                        :title="nameErrors[emp.id] ? 'Ogiltigt namn – ändra och tryck Enter' : 'Klicka för att redigera namn'"
                        @blur="saveName(emp.id)"
                        @keyup.enter="blurInput($event)"
                      />
                      <button
                        class="btn-delete"
                        title="Ta bort person"
                        @click.stop="confirmDeleteId = emp.id"
                      >✕</button>
                    </div>
                  </td>

                  <!-- Day cells -->
                  <td
                    v-for="day in md.days"
                    :key="day.dateStr"
                    :class="[
                      'day-cell',
                      { weekend: day.isWeekend, holiday: day.isHoliday },
                      { toggling: isToggling(emp.id, day.dateStr) },
                    ]"
                    :style="isRequested(emp.id, day.dateStr)
                      ? { background: empColor(idx) }
                      : {}"
                    @click="toggleDay(emp.id, day.dateStr)"
                  >
                    <span v-if="isRequested(emp.id, day.dateStr)" class="check">✓</span>
                  </td>
                </tr>
              </tbody>

              <tfoot>
                <tr class="count-row">
                  <td class="sticky-col count-label">Lediga</td>
                  <td
                    v-for="day in md.days"
                    :key="day.dateStr"
                    class="count-cell"
                  >
                    <span v-if="countPerDay(day.dateStr) > 0" class="count-badge">
                      {{ countPerDay(day.dateStr) }}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Legend -->
        <div class="legend">
          <span class="legend-item"><span class="swatch weekend"></span>Helg</span>
          <span class="legend-item"><span class="swatch holiday"></span>Röd dag</span>
          <span class="legend-item"><span class="swatch requested"></span>Önskar ledigt</span>
        </div>
      </template>
    </main>

    <!-- ───────────────────────── Delete confirmation modal ─────────────── -->
    <div v-if="confirmDeleteId !== null" class="modal-overlay" @click.self="confirmDeleteId = null">
      <div class="modal">
        <p class="modal-title">⚠️ Ta bort person?</p>
        <p class="modal-body">
          Är du säker på att du vill ta bort
          <strong>{{ employees.find(e => e.id === confirmDeleteId)?.name }}</strong>?
          Alla semesterdagar för denna person raderas också.
        </p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="confirmDeleteId = null">Avbryt</button>
          <button class="btn-confirm-delete" @click="deleteEmployee(confirmDeleteId!)">Ja, ta bort</button>
        </div>
      </div>
    </div>

    <!-- ───────────────────────── Toast ──────────────────────────────────── -->
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// ─── Types ───────────────────────────────────────────────────────────────────
interface Employee {
  id: number
  name: string
  created_at: string
}

interface DayInfo {
  dateStr: string
  dayOfMonth: number
  dayAbbr: string
  isWeekend: boolean
  isHoliday: boolean
  isoWeek: number
}

interface WeekGroup {
  isoWeek: number
  days: DayInfo[]
}

interface MonthData {
  monthNum: number
  monthName: string
  icon: string
  days: DayInfo[]
  weekGroups: WeekGroup[]
  hasHolidays: boolean
  holidayNames: Map<string, string>
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SUMMER_MONTHS = [
  { value: 6, label: 'Juni',    icon: '🌊' },
  { value: 7, label: 'Juli',    icon: '☀️' },
  { value: 8, label: 'Augusti', icon: '🌻' },
]

// Index 0 = Sunday
const DAY_ABBR_SV = ['Sö', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']

const COLORS = [
  '#E74C3C', '#2E86C1', '#27AE60', '#F5A623', '#8E44AD',
  '#16A085', '#D35400', '#C0392B', '#2980B9', '#1ABC9C',
]

// ─── Composable ──────────────────────────────────────────────────────────────
const { getHolidays } = useSwedishHolidays()

// ─── State ───────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear()
const year = ref(currentYear)

const employees = ref<Employee[]>([])
const loadingEmployees = ref(true)

const requestedSet = ref(new Set<string>())
const togglingSet  = ref(new Set<string>())

const newName       = ref('')
const addingEmployee = ref(false)

const confirmDeleteId = ref<number | null>(null)

const editNames  = reactive<Record<number, string>>({})
const nameErrors = reactive<Record<number, boolean>>({})

const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

// ─── Derived ─────────────────────────────────────────────────────────────────
const yearOptions = computed(() =>
  Array.from({ length: 9 }, (_, i) => currentYear - 3 + i)
)

const holidays = computed(() => getHolidays(year.value))

/** Map of date → short holiday name (for June–August) */
const holidayNamesMap = computed<Map<string, string>>(() => {
  const y = year.value
  const map = new Map<string, string>()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

  map.set(fmt(6, 6), 'Nationaldag')

  // Pingstdagen = Easter + 49 days (can fall in early June)
  const easter = computeEaster(y)
  const pentecost = new Date(easter)
  pentecost.setDate(pentecost.getDate() + 49)
  if (pentecost.getMonth() === 5) {
    map.set(fmt(6, pentecost.getDate()), 'Pingstdagen')
  }

  // Midsommarafton – Friday 19–25 June
  for (let d = 19; d <= 25; d++) {
    if (new Date(y, 5, d).getDay() === 5) { map.set(fmt(6, d), 'Midsommarafton'); break }
  }

  // Midsommardagen – Saturday 20–26 June
  for (let d = 20; d <= 26; d++) {
    if (new Date(y, 5, d).getDay() === 6) { map.set(fmt(6, d), 'Midsommardagen'); break }
  }

  return map
})

const monthsData = computed<MonthData[]>(() => {
  const hols  = holidays.value
  const hNames = holidayNamesMap.value

  return SUMMER_MONTHS.map(({ value: monthNum, label: monthName, icon }) => {
    const daysInMonth = new Date(year.value, monthNum, 0).getDate()
    const days: DayInfo[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dt  = new Date(year.value, monthNum - 1, d)
      const dow = dt.getDay()
      const dateStr = fmtDate(year.value, monthNum, d)
      days.push({
        dateStr,
        dayOfMonth: d,
        dayAbbr: DAY_ABBR_SV[dow],
        isWeekend: dow === 0 || dow === 6,
        isHoliday: hols.has(dateStr),
        isoWeek: getISOWeek(dt),
      })
    }

    const weekGroups: WeekGroup[] = []
    let current: WeekGroup | null = null
    for (const day of days) {
      if (!current || current.isoWeek !== day.isoWeek) {
        current = { isoWeek: day.isoWeek, days: [] }
        weekGroups.push(current)
      }
      current.days.push(day)
    }

    return {
      monthNum,
      monthName,
      icon,
      days,
      weekGroups,
      hasHolidays: days.some(d => d.isHoliday),
      holidayNames: hNames,
    }
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getISOWeek(date: Date): number {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function computeEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * mm + 114) / 31)
  const day   = ((h + l - 7 * mm + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function requestKey(employeeId: number, dateStr: string): string {
  return `${employeeId}|${dateStr}`
}

function isRequested(employeeId: number, dateStr: string): boolean {
  return requestedSet.value.has(requestKey(employeeId, dateStr))
}

function isToggling(employeeId: number, dateStr: string): boolean {
  return togglingSet.value.has(requestKey(employeeId, dateStr))
}

function empColor(idx: number): string {
  return COLORS[idx % COLORS.length]
}

function countPerDay(dateStr: string): number {
  let n = 0
  for (const emp of employees.value) {
    if (requestedSet.value.has(requestKey(emp.id, dateStr))) n++
  }
  return n
}

function blurInput(event: KeyboardEvent) {
  (event.target as HTMLElement).blur()
}

function getErrorStatus(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined
  const err = e as Record<string, unknown>
  if (err.response && typeof err.response === 'object') {
    return (err.response as Record<string, unknown>).status as number | undefined
  }
  return err.statusCode as number | undefined
}

function printPage() {
  if (typeof window !== 'undefined') window.print()
}

function showToast(message: string, type: 'success' | 'error') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}

function initEmployee(emp: Employee) {
  editNames[emp.id]  = emp.name
  nameErrors[emp.id] = false
}

// ─── API calls ───────────────────────────────────────────────────────────────
async function loadEmployees() {
  loadingEmployees.value = true
  try {
    const data = await $fetch<Employee[]>('/api/employees')
    employees.value = data
    for (const emp of data) initEmployee(emp)
  } catch (e) {
    console.error('Failed to load employees', e)
  } finally {
    loadingEmployees.value = false
  }
}

async function loadRequests() {
  const from = fmtDate(year.value, 6, 1)
  const to   = fmtDate(year.value, 8, 31)
  try {
    const data = await $fetch<{ employeeId: number; date: string }[]>(
      `/api/requests?from=${from}&to=${to}`
    )
    const s = new Set<string>()
    for (const r of data) s.add(requestKey(r.employeeId, r.date))
    requestedSet.value = s
  } catch (e) {
    console.error('Failed to load requests', e)
  }
}

async function addEmployee() {
  const name = newName.value.trim()
  if (!name || addingEmployee.value) return
  addingEmployee.value = true
  try {
    const emp = await $fetch<Employee>('/api/employees', {
      method: 'POST',
      body: { name },
    })
    const idx = employees.value.findIndex(e => e.id === emp.id)
    if (idx === -1) {
      employees.value = [...employees.value, emp]
      initEmployee(emp)
      showToast(`"${emp.name}" lades till ✓`, 'success')
    } else {
      showToast(`"${emp.name}" finns redan`, 'success')
    }
    newName.value = ''
  } catch (e) {
    console.error('Failed to add employee', e)
    showToast('Kunde inte lägga till personen', 'error')
  } finally {
    addingEmployee.value = false
  }
}

async function deleteEmployee(empId: number) {
  try {
    await $fetch(`/api/employees/${empId}`, { method: 'DELETE' })
    employees.value = employees.value.filter(e => e.id !== empId)
    const next = new Set<string>()
    for (const key of requestedSet.value) {
      if (!key.startsWith(`${empId}|`)) next.add(key)
    }
    requestedSet.value = next
    showToast('Person borttagen ✓', 'success')
  } catch (e) {
    showToast('Kunde inte ta bort personen', 'error')
  } finally {
    confirmDeleteId.value = null
  }
}

async function saveName(empId: number) {
  const newVal = (editNames[empId] ?? '').trim()
  const emp    = employees.value.find(e => e.id === empId)
  if (!emp) return
  if (newVal === emp.name) { nameErrors[empId] = false; return }
  if (!newVal) {
    nameErrors[empId] = true
    editNames[empId]  = emp.name
    showToast('Namn kan inte vara tomt', 'error')
    return
  }
  try {
    const updated = await $fetch<Employee>(`/api/employees/${empId}`, {
      method: 'PATCH',
      body: { name: newVal },
    })
    const idx = employees.value.findIndex(e => e.id === empId)
    if (idx !== -1) employees.value[idx] = updated
    editNames[empId]  = updated.name
    nameErrors[empId] = false
    showToast('Namn sparat ✓', 'success')
  } catch (e: unknown) {
    const status = getErrorStatus(e)
    if (status === 409) {
      nameErrors[empId] = true
      showToast('Det namnet finns redan', 'error')
    } else {
      nameErrors[empId] = true
      showToast('Kunde inte spara', 'error')
    }
    editNames[empId] = emp.name
  }
}

async function toggleDay(employeeId: number, dateStr: string) {
  const key = requestKey(employeeId, dateStr)
  if (togglingSet.value.has(key)) return
  togglingSet.value = new Set(togglingSet.value).add(key)
  const was = requestedSet.value.has(key)
  // Optimistic update
  const next = new Set(requestedSet.value)
  was ? next.delete(key) : next.add(key)
  requestedSet.value = next
  try {
    await $fetch('/api/requests/toggle', {
      method: 'POST',
      body: { employeeId, date: dateStr },
    })
  } catch (e) {
    console.error('Toggle failed, reverting', e)
    const revert = new Set(requestedSet.value)
    was ? revert.add(key) : revert.delete(key)
    requestedSet.value = revert
  } finally {
    const s = new Set(togglingSet.value)
    s.delete(key)
    togglingSet.value = s
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadEmployees()
  await loadRequests()
})

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>
