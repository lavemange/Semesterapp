<template>
  <div class="app">
    <!-- ───────────────────────── Header ───────────────────────── -->
    <header class="app-header">
      <div class="header-title">
        <span class="logo">📅</span>
        <h1>SemesterApp</h1>
      </div>

      <div class="controls">
        <!-- Year selector -->
        <div class="control-group">
          <label for="year-select">År</label>
          <select id="year-select" v-model="year" @change="loadRequests">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <!-- Month selector -->
        <div class="control-group">
          <label>Månad</label>
          <div class="month-tabs">
            <button
              v-for="m in months"
              :key="m.value"
              :class="['month-btn', { active: month === m.value }]"
              @click="selectMonth(m.value)"
            >
              {{ m.label }}
            </button>
          </div>
        </div>

        <!-- Name input -->
        <div class="control-group name-group">
          <label for="name-input">Ditt namn</label>
          <div class="name-row">
            <input
              id="name-input"
              v-model="newName"
              type="text"
              placeholder="Skriv ditt namn…"
              maxlength="100"
              @keyup.enter="addEmployee"
            />
            <button class="btn-primary" :disabled="!newName.trim() || addingEmployee" @click="addEmployee">
              {{ addingEmployee ? '…' : 'Lägg till / välj mig' }}
            </button>
          </div>
          <p v-if="addMessage" class="add-message" :class="addMessageType">{{ addMessage }}</p>
        </div>
      </div>
    </header>

    <!-- ───────────────────────── Grid ─────────────────────────── -->
    <main class="grid-outer">
      <div v-if="loadingEmployees" class="loading-state">Laddar…</div>
      <div v-else-if="employees.length === 0" class="empty-state">Inga anställda hittades.</div>
      <div v-else class="grid-scroll">
        <table class="calendar-table">
          <thead>
            <!-- Row 1: week numbers -->
            <tr class="week-header-row">
              <th class="sticky-name-col header-name-cell">Namn</th>
              <th
                v-for="wg in weekGroups"
                :key="wg.isoWeek"
                :colspan="wg.days.length"
                class="week-cell"
              >
                V.{{ wg.isoWeek }}
              </th>
            </tr>
            <!-- Row 2: day numbers + abbreviations -->
            <tr class="day-header-row">
              <th class="sticky-name-col day-name-header-cell"></th>
              <th
                v-for="day in days"
                :key="day.dateStr"
                :class="['day-header-cell', { weekend: day.isWeekend, holiday: day.isHoliday }]"
              >
                <span class="day-num">{{ day.dayOfMonth }}</span>
                <span class="day-abbr">{{ day.dayAbbr }}</span>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="emp in employees"
              :key="emp.id"
              :class="['emp-row', { 'active-employee': activeEmployeeId === emp.id }]"
            >
              <td class="sticky-name-col emp-name-cell">{{ emp.name }}</td>
              <td
                v-for="day in days"
                :key="day.dateStr"
                :class="[
                  'day-cell',
                  { weekend: day.isWeekend, holiday: day.isHoliday },
                  { requested: isRequested(emp.id, day.dateStr) },
                  { toggling: isToggling(emp.id, day.dateStr) },
                ]"
                :title="cellTitle(emp, day)"
                @click="toggleDay(emp.id, day.dateStr)"
              ></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div class="legend">
        <span class="legend-item"><span class="swatch weekend"></span>Helg</span>
        <span class="legend-item"><span class="swatch holiday"></span>Röd dag / Midsommarafton</span>
        <span class="legend-item"><span class="swatch requested"></span>Önskar ledigt</span>
      </div>
    </main>
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
  dateStr: string       // YYYY-MM-DD
  dayOfMonth: number
  dayAbbr: string       // Mån Tis…
  isWeekend: boolean
  isHoliday: boolean
  isoWeek: number
}

interface WeekGroup {
  isoWeek: number
  days: DayInfo[]
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS = [
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Augusti' },
]
const DAY_ABBR_SV = ['Sö', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']

// ─── Composable ──────────────────────────────────────────────────────────────
const { getHolidays } = useSwedishHolidays()

// ─── State ───────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear()
const year = ref(currentYear)
const month = ref(6) // June

const employees = ref<Employee[]>([])
const loadingEmployees = ref(true)

// Set of "employeeId|YYYY-MM-DD" strings
const requestedSet = ref(new Set<string>())
const loadingRequests = ref(false)

const newName = ref('')
const addingEmployee = ref(false)
const addMessage = ref('')
const addMessageType = ref<'success' | 'info'>('success')
let addMessageTimer: ReturnType<typeof setTimeout> | null = null

const activeEmployeeId = ref<number | null>(null)

// Set of currently-toggling "employeeId|date" to prevent double-clicks
const togglingSet = ref(new Set<string>())

// ─── Derived ─────────────────────────────────────────────────────────────────
const months = MONTHS
const yearOptions = computed(() =>
  Array.from({ length: 9 }, (_, i) => currentYear - 3 + i)
)

const holidays = computed(() => getHolidays(year.value))

/** All days in the selected month/year */
const days = computed<DayInfo[]>(() => {
  const daysInMonth = new Date(year.value, month.value, 0).getDate()
  const result: DayInfo[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year.value, month.value - 1, d)
    const dow = dt.getDay() // 0=Sun … 6=Sat
    const dateStr = fmtDate(year.value, month.value, d)
    result.push({
      dateStr,
      dayOfMonth: d,
      dayAbbr: DAY_ABBR_SV[dow],
      isWeekend: dow === 0 || dow === 6,
      isHoliday: holidays.value.has(dateStr),
      isoWeek: getISOWeek(dt),
    })
  }
  return result
})

/** Days grouped by ISO week (preserves order within month) */
const weekGroups = computed<WeekGroup[]>(() => {
  const groups: WeekGroup[] = []
  let current: WeekGroup | null = null
  for (const day of days.value) {
    if (!current || current.isoWeek !== day.isoWeek) {
      current = { isoWeek: day.isoWeek, days: [] }
      groups.push(current)
    }
    current.days.push(day)
  }
  return groups
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function requestKey(employeeId: number, dateStr: string) {
  return `${employeeId}|${dateStr}`
}

function isRequested(employeeId: number, dateStr: string) {
  return requestedSet.value.has(requestKey(employeeId, dateStr))
}

function isToggling(employeeId: number, dateStr: string) {
  return togglingSet.value.has(requestKey(employeeId, dateStr))
}

function cellTitle(emp: Employee, day: DayInfo) {
  const state = isRequested(emp.id, day.dateStr) ? 'Önskar ledigt' : 'Klicka för att markera ledigt'
  return `${emp.name} – ${day.dateStr} – ${state}`
}

function fromToForMonth() {
  const daysInMonth = new Date(year.value, month.value, 0).getDate()
  return {
    from: fmtDate(year.value, month.value, 1),
    to: fmtDate(year.value, month.value, daysInMonth),
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────
async function loadEmployees() {
  loadingEmployees.value = true
  try {
    const data = await $fetch<Employee[]>('/api/employees')
    employees.value = data
  } catch (e) {
    console.error('Failed to load employees', e)
  } finally {
    loadingEmployees.value = false
  }
}

async function loadRequests() {
  loadingRequests.value = true
  const { from, to } = fromToForMonth()
  try {
    const data = await $fetch<{ employeeId: number; date: string }[]>(
      `/api/requests?from=${from}&to=${to}`
    )
    const s = new Set<string>()
    for (const r of data) s.add(requestKey(r.employeeId, r.date))
    requestedSet.value = s
  } catch (e) {
    console.error('Failed to load requests', e)
  } finally {
    loadingRequests.value = false
  }
}

async function addEmployee() {
  const name = newName.value.trim()
  if (!name || addingEmployee.value) return
  addingEmployee.value = true
  addMessage.value = ''
  try {
    const emp = await $fetch<Employee>('/api/employees', {
      method: 'POST',
      body: { name },
    })
    // Upsert into local list
    const idx = employees.value.findIndex(e => e.id === emp.id)
    if (idx === -1) {
      employees.value = [...employees.value, emp]
      addMessage.value = `✅ "${emp.name}" lades till.`
    } else {
      addMessage.value = `ℹ️ "${emp.name}" finns redan – vald.`
    }
    addMessageType.value = idx === -1 ? 'success' : 'info'
    activeEmployeeId.value = emp.id
    newName.value = ''
  } catch (e) {
    console.error('Failed to add employee', e)
    addMessage.value = '❌ Kunde inte lägga till. Försök igen.'
    addMessageType.value = 'info'
  } finally {
    addingEmployee.value = false
    // Auto-clear message after 4 s
    if (addMessageTimer) clearTimeout(addMessageTimer)
    addMessageTimer = setTimeout(() => { addMessage.value = '' }, 4000)
  }
}

async function toggleDay(employeeId: number, dateStr: string) {
  const key = requestKey(employeeId, dateStr)
  if (togglingSet.value.has(key)) return // prevent double-click
  togglingSet.value = new Set(togglingSet.value).add(key)
  const wasRequested = requestedSet.value.has(key)
  // Optimistic update
  const next = new Set(requestedSet.value)
  wasRequested ? next.delete(key) : next.add(key)
  requestedSet.value = next
  try {
    await $fetch('/api/requests/toggle', {
      method: 'POST',
      body: { employeeId, date: dateStr },
    })
  } catch (e) {
    console.error('Toggle failed, reverting', e)
    // Revert optimistic update
    const revert = new Set(requestedSet.value)
    wasRequested ? revert.add(key) : revert.delete(key)
    requestedSet.value = revert
  } finally {
    const s = new Set(togglingSet.value)
    s.delete(key)
    togglingSet.value = s
  }
}

function selectMonth(m: number) {
  month.value = m
  loadRequests()
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadEmployees()
  await loadRequests()
})

onBeforeUnmount(() => {
  if (addMessageTimer) clearTimeout(addMessageTimer)
})
</script>
